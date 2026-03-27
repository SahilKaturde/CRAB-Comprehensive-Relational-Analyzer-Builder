from django.urls import path
from .views import ListHistoryView, AddHistoryView

urlpatterns = [
    path('list/', ListHistoryView.as_view(), name='history_list'),
    path('add/', AddHistoryView.as_view(), name='history_add'),
]
