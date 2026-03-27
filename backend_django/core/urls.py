from django.contrib import admin
from django.urls import path
from test_api.views import test_django

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_django),
]