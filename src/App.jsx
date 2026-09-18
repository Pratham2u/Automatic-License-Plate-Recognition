import React, { useMemo, useState } from 'react';
import detectionData from '../output.json';

const SAMPLE_RESULTS = detectionData.map((entry, index) => {
  const detection = entry.results?.[0] ?? {};
  const box = detection.box ?? { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };
  const vehicle = detection.vehicle ?? {};
  const vehicleBox = vehicle.box ?? { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };

  return {
    id: `sample-${index}`,
    title: entry.filename ?? `vehicle-${index + 1}`,
    imageUrl: `/Sample_Images/${entry.filename}`,
    plate: detection.plate ?? 'No plate found',
    score: detection.score ?? vehicle.score ?? 0,
    region: detection.region?.code ?? 'N/A',
    vehicleType: vehicle.type ?? 'Unknown',
    vehicleScore: vehicle.score ?? 0,
    plateBox: box,
    vehicleBox,
    timestamp: entry.timestamp ?? 'Unknown',
    status: detection.plate ? 'Detected' : 'Pending',
  };
});

const formatScore = (value) => `${(Number(value) * 100 || 0).toFixed(1)}%`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function App() {
  const [uploadedRecords, setUploadedRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(SAMPLE_RESULTS[0]?.id ?? 'uploaded-0');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const records = useMemo(
    () => [...uploadedRecords, ...SAMPLE_RESULTS],
    [uploadedRecords]
  );

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? records[0] ?? null;

  const stats = useMemo(() => {
    const allDetected = records.filter((record) => record.plate && record.plate !== 'No plate found');
    const avgScore =
      allDetected.length > 0
        ? allDetected.reduce((sum, record) => sum + Number(record.score || 0), 0) /
          allDetected.length
        : 0;

    return {
      total: records.length,
      detected: allDetected.length,
      averageConfidence: avgScore,
      vehicles: new Set(records.map((record) => record.vehicleType)).size,
    };
  }, [records]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError('');
    const previewUrl = URL.createObjectURL(file);
    const id = `uploaded-${Date.now()}`;
    const record = {
      id,
      title: file.name,
      imageUrl: previewUrl,
      plate: 'Awaiting recognition',
      score: 0,
      region: 'Local file',
      vehicleType: 'Vehicle',
      vehicleScore: 0,
      plateBox: { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
      vehicleBox: { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
      timestamp: new Date().toISOString(),
      status: 'Queued',
    };

    setUploadedRecords((current) => [record, ...current]);
    setSelectedId(id);
    setIsRecognizing(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/recognize', {
        method: 'POST',
        body: formData,
      });
      const responseText = await response.text();
      let payload = {};
      if (responseText.trim()) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          if (response.status === 500) {
            throw new Error(
              'Recognition backend is not running. Start it with: python server.py'
            );
          }
          throw new Error(
            `Recognition backend returned invalid JSON (${response.status}).`
          );
        }
      }
      if (!response.ok) {
        if (response.status === 500 && !payload.error) {
          throw new Error(
            'Recognition backend is not running. Start it with: python server.py'
          );
        }
        throw new Error(
          payload.error || `Recognition backend failed with HTTP ${response.status}.`
        );
      }

      const detection = payload.results?.[0];
      const nextRecord = {
        ...record,
        plate: detection?.plate || 'No plate found',
        score: detection?.score || 0,
        region: detection?.region?.code || 'N/A',
        vehicleType: detection?.vehicle?.type || 'Unknown',
        vehicleScore: detection?.vehicle?.score || 0,
        plateBox: detection?.box || record.plateBox,
        vehicleBox: detection?.vehicle?.box || record.vehicleBox,
        timestamp: payload.timestamp || new Date().toISOString(),
        status: detection?.plate ? 'Detected' : 'No plate',
      };
      setUploadedRecords((current) =>
        current.map((item) => (item.id === id ? nextRecord : item))
      );
    } catch (error) {
      const message =
        error instanceof TypeError
          ? 'Could not connect to the recognition backend. Start it with: python server.py'
          : error instanceof Error
            ? error.message
            : 'Recognition failed.';
      setUploadError(message);
      setUploadedRecords((current) =>
        current.map((item) =>
          item.id === id ? { ...item, plate: 'Recognition failed', status: 'Error' } : item
        )
      );
    } finally {
      setIsRecognizing(false);
      event.target.value = '';
    }
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Vision intelligence</p>
          <h1>Automatic License Plate Recognition</h1>
        </div>
        <label className={`upload-button ${isRecognizing ? 'disabled' : ''}`} htmlFor="vehicle-upload">
          {isRecognizing ? 'Recognizing...' : '+ Upload image'}
        </label>
        <input id="vehicle-upload" type="file" accept="image/*" onChange={handleUpload} />
      </header>
      {uploadError && <p className="upload-error">{uploadError}</p>}

      <section className="stats-grid">
        <article className="stat-card accent">
          <span>Total analyzed</span>
          <strong>{stats.total}</strong>
          <small>records</small>
        </article>
        <article className="stat-card">
          <span>Plates detected</span>
          <strong>{stats.detected}</strong>
          <small>successful reads</small>
        </article>
        <article className="stat-card">
          <span>Average confidence</span>
          <strong>{formatScore(stats.averageConfidence)}</strong>
          <small>model certainty</small>
        </article>
        <article className="stat-card">
          <span>Vehicle classes</span>
          <strong>{stats.vehicles}</strong>
          <small>unique types</small>
        </article>
      </section>

      <main className="content-grid">
        <aside className="sidebar panel">
          <div className="panel-header">
            <h2>Detection feed</h2>
            <span>{records.length} items</span>
          </div>

          <div className="result-list">
            {records.map((record) => (
              <button
                type="button"
                key={record.id}
                className={`result-item ${selectedId === record.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(record.id)}
              >
                <img src={record.imageUrl} alt={record.title} />
                <div className="result-summary">
                  <div className="summary-row">
                    <strong>{record.plate}</strong>
                    <span className={`status-pill ${record.status === 'Queued' ? 'queued' : record.status === 'Error' ? 'error' : 'detected'}`}>
                      {record.status}
                    </span>
                  </div>
                  <p>{record.vehicleType}</p>
                  <small>{record.region}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-panel panel">
          {selectedRecord ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Live overview</p>
                  <h2>{selectedRecord.title}</h2>
                </div>
                <div className="detail-badges">
                  <span className="tag">{selectedRecord.region}</span>
                  <span className="tag muted">{selectedRecord.vehicleType}</span>
                </div>
              </div>

              <div className="image-stage">
                <img
                  src={selectedRecord.imageUrl}
                  alt={selectedRecord.title}
                  className="detail-image"
                />
                <DetectionOverlay record={selectedRecord} />
              </div>

              <div className="metrics-strip">
                <div>
                  <label>Plate</label>
                  <strong>{selectedRecord.plate}</strong>
                </div>
                <div>
                  <label>Confidence</label>
                  <strong>{formatScore(selectedRecord.score)}</strong>
                </div>
                <div>
                  <label>Vehicle score</label>
                  <strong>{formatScore(selectedRecord.vehicleScore)}</strong>
                </div>
                <div>
                  <label>Captured</label>
                  <strong>{new Date(selectedRecord.timestamp).toLocaleString()}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>No image selected</h2>
              <p>Choose a detection from the feed or upload a new vehicle photo.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function DetectionOverlay({ record }) {
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  const toStyle = (box, colorClass) => {
    if (!box || !box.xmin && !box.ymin && !box.xmax && !box.ymax) {
      return null;
    }

    const left = clamp((box.xmin / imageSize.width) * 100, 0, 100);
    const top = clamp((box.ymin / imageSize.height) * 100, 0, 100);
    const width = clamp(((box.xmax - box.xmin) / imageSize.width) * 100, 0, 100);
    const height = clamp(((box.ymax - box.ymin) / imageSize.height) * 100, 0, 100);

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      borderColor: colorClass,
    };
  };

  const plateStyle = toStyle(record.plateBox, '#5eead4');
  const vehicleStyle = toStyle(record.vehicleBox, '#fca5a5');

  return (
    <div className="overlay-layer" aria-hidden="true">
      <img
        src={record.imageUrl}
        alt=""
        className="overlay-spacer"
        onLoad={(event) =>
          setImageSize({
            width: event.target.naturalWidth || 1,
            height: event.target.naturalHeight || 1,
          })
        }
      />
      {plateStyle && <span className="box-overlay plate" style={plateStyle} />}
      {vehicleStyle && <span className="box-overlay vehicle" style={vehicleStyle} />}
    </div>
  );
}

export default App;
