import React, { useState } from 'react';
import './DataBackup.css';

function DataBackup({
  completedDays,
  completedExercises,
  startDate,
  reminderSettings,
  onImport
}) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Export data as JSON
  const handleExport = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      completedDays,
      completedExercises,
      startDate: startDate.toISOString(),
      reminderSettings,
      metadata: {
        totalDays: completedDays.length,
        totalExercises: Object.keys(completedExercises).filter(k => completedExercises[k]).length
      }
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `30gunfit-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import data from JSON file
  const handleImport = (event) => {
    setImporting(true);
    setImportError(null);
    setImportSuccess(false);

    const file = event.target.files[0];
    if (!file) {
      setImporting(false);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        // Validate data
        if (!imported.version || !imported.completedDays || !imported.startDate) {
          throw new Error('Geçersiz yedek dosyası formatı');
        }

        // Confirm overwrite
        const confirmOverwrite = window.confirm(
          `Bu yedek ${imported.metadata.totalDays} gün ve ${imported.metadata.totalExercises} egzersiz içeriyor.\n\n` +
          `Mevcut verileriniz silinip yerine bu yedek yüklenecek. Emin misiniz?`
        );

        if (!confirmOverwrite) {
          setImporting(false);
          return;
        }

        // Import data
        onImport({
          completedDays: imported.completedDays || [],
          completedExercises: imported.completedExercises || {},
          startDate: new Date(imported.startDate),
          reminderSettings: imported.reminderSettings || {
            enabled: false,
            times: ['09:00', '13:00', '20:00']
          }
        });

        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (error) {
        console.error('Import error:', error);
        setImportError(error.message || 'Dosya yüklenirken hata oluştu');
      } finally {
        setImporting(false);
        event.target.value = null; // Reset file input
      }
    };

    reader.onerror = () => {
      setImportError('Dosya okunamadı');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  // Clear all data
  const handleClearData = () => {
    const confirm = window.confirm(
      'TÜM VERİLERİNİZ SİLİNECEK!\n\n' +
      'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?\n\n' +
      'Önce yedek almanızı öner iriz.'
    );

    if (!confirm) return;

    const doubleConfirm = window.prompt(
      'Emin misiniz? Onaylamak için "SİL" yazın:'
    );

    if (doubleConfirm === 'SİL') {
      onImport({
        completedDays: [],
        completedExercises: {},
        startDate: new Date(),
        reminderSettings: {
          enabled: false,
          times: ['09:00', '13:00', '20:00']
        }
      });
    }
  };

  return (
    <div className="data-backup">
      <div className="backup-header">
        <h3>💾 Veri Yedekleme</h3>
        <p>İlerlemenizi yedekleyin ve farklı cihazlarda kullanın</p>
      </div>

      <div className="backup-stats">
        <div className="stat">
          <span className="stat-value">{completedDays.length}</span>
          <span className="stat-label">Tamamlanan Gün</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {Object.keys(completedExercises).filter(k => completedExercises[k]).length}
          </span>
          <span className="stat-label">Tamamlanan Egzersiz</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {startDate.toLocaleDateString('tr-TR')}
          </span>
          <span className="stat-label">Başlangıç Tarihi</span>
        </div>
      </div>

      <div className="backup-actions">
        <button className="btn-export" onClick={handleExport}>
          📥 Yedek Al
        </button>

        <label className="btn-import">
          📤 Yedek Yükle
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            style={{ display: 'none' }}
          />
        </label>

        <button className="btn-clear" onClick={handleClearData}>
          🗑️ Tüm Verileri Sil
        </button>
      </div>

      {importError && (
        <div className="import-message error">
          ❌ Hata: {importError}
        </div>
      )}

      {importSuccess && (
        <div className="import-message success">
          ✅ Yedek başarıyla yüklendi!
        </div>
      )}

      {importing && (
        <div className="import-message">
          ⏳ Yükleniyor...
        </div>
      )}

      <div className="backup-info">
        <h4>ℹ️ Bilgi</h4>
        <ul>
          <li><strong>Yedek Al:</strong> Verilerinizi JSON dosyası olarak indirir</li>
          <li><strong>Yedek Yükle:</strong> Daha önce aldığınız yedeği geri yükler</li>
          <li><strong>Güvenlik:</strong> Verileriniz sadece cihazınızda saklanır</li>
          <li><strong>Cihaz Değişimi:</strong> Yedek alıp başka cihazda yükleyebilirsiniz</li>
        </ul>
      </div>
    </div>
  );
}

export default DataBackup;
