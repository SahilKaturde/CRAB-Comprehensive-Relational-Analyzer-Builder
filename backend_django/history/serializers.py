from rest_framework import serializers
from .models import HistoryRecord

class HistoryRecordSerializer(serializers.ModelSerializer):
    """Serializes history record objects."""
    
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = HistoryRecord
        fields = ['id', 'user_name', 'filename', 'file_type', 'table_count', 'query_performed', 'timestamp']
        read_only_fields = ['user', 'timestamp']
