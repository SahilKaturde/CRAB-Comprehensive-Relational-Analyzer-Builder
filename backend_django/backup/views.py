import os
import zipfile
import threading
from datetime import datetime
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import BackupRecord

def run_backup_job(record_id):
    try:
        record = BackupRecord.objects.get(id=record_id)
        record.status = 'IN_PROGRESS'
        record.save()

        # Define paths
        backup_dir = os.path.join(settings.BASE_DIR, 'secure_backups')
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        zip_filename = f"backup_{timestamp}.zip"
        zip_path = os.path.join(backup_dir, zip_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 1. Backup DB
            if record.backup_type in ['FULL', 'DB_ONLY']:
                db_path = os.path.join(settings.BASE_DIR, 'db.sqlite3')
                if os.path.exists(db_path):
                    zipf.write(db_path, arcname='db.sqlite3')

            # 2. Backup Media
            if record.backup_type in ['FULL', 'MEDIA_ONLY']:
                media_path = os.path.join(settings.BASE_DIR, 'uploads') # as per Dataset model
                if os.path.exists(media_path):
                    for root, dirs, files in os.walk(media_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, settings.BASE_DIR)
                            zipf.write(file_path, arcname=arcname)

        record.status = 'COMPLETED'
        record.file.name = f"secure_backups/{zip_filename}"
        record.file_size_bytes = os.path.getsize(zip_path)
        record.completed_at = datetime.now()
        record.save()

    except Exception as e:
        if 'record' in locals():
            record.status = 'FAILED'
            record.error_message = str(e)
            record.save()

class StartBackupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        backup_type = request.data.get('backup_type', 'FULL')
        
        if backup_type not in ['FULL', 'DB_ONLY', 'MEDIA_ONLY']:
            return Response({"error": "Invalid backup_type"}, status=status.HTTP_400_BAD_REQUEST)

        record = BackupRecord.objects.create(
            triggered_by=request.user,
            backup_type=backup_type,
            status='PENDING'
        )

        # Start background thread
        thread = threading.Thread(target=run_backup_job, args=(record.id,))
        thread.start()

        return Response({
            "message": "Backup started successfully",
            "backup_id": record.id,
            "status": record.status
        }, status=status.HTTP_202_ACCEPTED)

class ListBackupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_superuser:
            backups = BackupRecord.objects.all().order_by('-created_at')
        else:
            backups = BackupRecord.objects.filter(triggered_by=request.user).order_by('-created_at')

        data = []
        for b in backups:
            data.append({
                "id": b.id,
                "backup_type": b.backup_type,
                "status": b.status,
                "created_at": b.created_at,
                "completed_at": b.completed_at,
                "file_size_bytes": b.file_size_bytes,
                "error_message": b.error_message,
            })
        return Response(data)

class DeleteBackupView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            if request.user.is_superuser:
                backup = BackupRecord.objects.get(id=pk)
            else:
                backup = BackupRecord.objects.get(id=pk, triggered_by=request.user)
            
            # Delete physical file if it exists
            if backup.file and backup.file.name:
                file_path = os.path.join(settings.BASE_DIR, backup.file.name)
                if os.path.exists(file_path):
                    os.remove(file_path)

            backup.delete()
            return Response({"message": "Backup deleted successfully"}, status=status.HTTP_200_OK)

        except BackupRecord.DoesNotExist:
            return Response({"error": "Backup not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
