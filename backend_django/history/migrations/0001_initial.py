from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='HistoryRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filename', models.CharField(max_length=255)),
                ('file_type', models.CharField(choices=[('CSV', 'CSV Dataset'), ('SQL', 'SQL Script'), ('DB', 'SQLite Database')], max_length=10)),
                ('table_count', models.IntegerField(default=0)),
                ('query_performed', models.CharField(default='Full Ingestion', max_length=255)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='analysis_history', to='auth.user')),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
    ]
