from django.urls import path
from .views import StartBackupView, ListBackupsView, DeleteBackupView

urlpatterns = [
    path('start/', StartBackupView.as_view(), name='start_backup'),
    path('list/', ListBackupsView.as_view(), name='list_backups'),
    path('delete/<int:pk>/', DeleteBackupView.as_view(), name='delete_backup'),
]
