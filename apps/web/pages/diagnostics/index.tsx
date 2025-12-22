import { useState } from 'react';
import { queryDiagnostics, importDiagnostics } from '@/services/api';

interface DiagnosticResult {
  plantName: string;
  diagnosis: string;
  recommendedAction: string;
  severity?: string;
}

export default function DiagnosticsPage() {
  const [symptoms, setSymptoms] = useState('');
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState('');

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    setLoading(true);
    try {
      const data = await queryDiagnostics(symptoms);
      setResults(data);
    } catch (error) {
      console.error('Failed to query diagnostics:', error);
      alert('Failed to query diagnostics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImportStatus('Importing...');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          await importDiagnostics(data);
          setImportStatus('Import successful!');
          setImportFile(null);
        } catch (error) {
          console.error('Import failed:', error);
          setImportStatus('Import failed. Please check the file format.');
        }
      };
      reader.readAsText(importFile);
    } catch (error) {
      console.error('Failed to read file:', error);
      setImportStatus('Failed to read file.');
    }
  };

  return (
    <div className="page-container">
      <h2>Plant Diagnostics</h2>

      <div className="diagnostics-sections">
        <section className="query-section">
          <h3>Query Symptoms</h3>
          <form onSubmit={handleQuery}>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Enter plant symptoms (e.g., yellowing leaves, spots, wilting)"
              rows={4}
              className="symptoms-input"
            />
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Searching...' : 'Search Diagnostics'}
            </button>
          </form>

          {results.length > 0 && (
            <div className="results">
              <h4>Possible Diagnoses:</h4>
              {results.map((result, index) => (
                <div key={index} className="diagnostic-result">
                  <h5>{result.plantName}</h5>
                  <p><strong>Diagnosis:</strong> {result.diagnosis}</p>
                  <p><strong>Recommended Action:</strong> {result.recommendedAction}</p>
                  {result.severity && (
                    <span className={`severity severity-${result.severity}`}>
                      {result.severity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="import-section">
          <h3>Import Plant Data</h3>
          <form onSubmit={handleImport}>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="file-input"
            />
            <button type="submit" disabled={!importFile} className="btn-secondary">
              Import JSON Data
            </button>
          </form>
          {importStatus && <p className="import-status">{importStatus}</p>}
          <p className="help-text">
            Upload a JSON file with plant and chemical data to populate the database.
          </p>
        </section>
      </div>
    </div>
  );
}
