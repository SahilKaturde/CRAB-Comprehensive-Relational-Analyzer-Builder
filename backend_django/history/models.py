from django.db import models
from django.contrib.auth.models import User

class HistoryRecord(models.Model):
    """Tracks analysis history for users."""
    
    FILE_TYPES = [
        ('CSV', 'CSV Dataset'),
        ('SQL', 'SQL Script'),
        ('DB', 'SQLite Database'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analysis_history')
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FILE_TYPES)
    table_count = models.IntegerField(default=0)
    query_performed = models.CharField(max_length=255, default="Full Ingestion")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.filename} ({self.file_type}) - {self.timestamp.date()}"
