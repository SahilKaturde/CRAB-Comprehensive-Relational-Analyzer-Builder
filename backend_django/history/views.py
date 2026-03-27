from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import HistoryRecord
from .serializers import HistoryRecordSerializer

class ListHistoryView(APIView):
    """
    Retrieves the analysis history for the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        history = HistoryRecord.objects.filter(user=request.user).order_by('-timestamp')
        serializer = HistoryRecordSerializer(history, many=True)
        return Response(serializer.data)

class AddHistoryView(APIView):
    """
    Creates a new history record for an analysis session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = HistoryRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
