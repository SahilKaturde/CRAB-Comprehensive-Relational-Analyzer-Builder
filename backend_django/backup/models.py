from django.db import models
from django.contrib.auth.models import User

class BackupRecord(models.Model):
    """Tracks the status and location of system and data backups."""
    
    BACKUP_TYPES = [
        ('DB_ONLY', 'Database Only'),
        ('MEDIA_ONLY', 'Uploaded Files Only'),
        ('FULL', 'Full System (DB + Media)')
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Waiting to Start'),
        ('IN_PROGRESS', 'Currently Backing Up...'),
        ('COMPLETED', 'Backup Successful'),
        ('FAILED', 'Backup Failed')
    ]

    # Who triggered the backup (can be null if triggered by an automated system/cron job)
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='triggered_backups')
    
    backup_type = models.CharField(max_length=20, choices=BACKUP_TYPES, default='FULL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Secure filepath location of the generated .zip, .json, or .sql file
    file = models.FileField(upload_to='secure_backups/%Y/%m/', null=True, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    
    # Flow tracking
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.get_backup_type_display()} - {self.status} ({self.created_at.date()})"
