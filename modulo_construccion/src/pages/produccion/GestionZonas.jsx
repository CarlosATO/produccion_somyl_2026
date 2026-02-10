import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Form, Card, ListGroup, Row, Col, Badge, InputGroup, Spinner, Modal } from 'react-bootstrap'
import * as XLSX from 'xlsx'
import { zonasService } from '../../services/zonasService'
import COMUNAS_CHILE from '../../data/comunasChile'

function GestionZonas() {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const fileInputRef = useRef(null)

    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)

    // Data
    const [zonas, setZonas] = useState([])
    const [tramos, setTramos] = useState([])

    // UI State
    const [selectedZona, setSelectedZona] = useState(null)

    // Modal Crear Zona
    const [showModal, setShowModal] = useState(false)
    const [formZona, setFormZona] = useState({
        nombre: '', hp: '', direccion: '', comuna: '',
        lat: '', lon: '', coords: '' // Estados para geo
    })

    // Form Tramo (Simple)
    const [newTramoName, setNewTramoName] = useState('')

    useEffect(() => {
        loadZonas()
    }, [projectId])

    const loadZonas = async () => {
        setLoading(true)
        try {
            const data = await zonasService.getZonas(projectId)
            setZonas(data)
            if (selectedZona) {
                const stillExists = data.find(z => z.id === selectedZona.id)
                if (stillExists) {
                    setSelectedZona(stillExists)
                    loadTramos(selectedZona.id)
                }
                else setSelectedZona(null)
            }
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const loadTramos = async (zonaId) => {
        try {
            const data = await zonasService.getTramos(zonaId)
            setTramos(data)
        } catch (err) { console.error(err) }
    }

    // --- HANDLERS ZONA ---
    const handleSelectZona = (zona) => {
        setSelectedZona(zona)
        setTramos([])
        loadTramos(zona.id)
    }

    // Abrir Modal
    const handleOpenModal = () => {
        setFormZona({ nombre: '', hp: '', direccion: '', comuna: '', lat: '', lon: '', coords: '' })
        setShowModal(true)
    }

    // Guardar Zona (Desde Modal)
    const handleSaveZona = async (e) => {
        e.preventDefault()
        if (!formZona.nombre.trim()) return
        // Normalizar comuna usando catálogo
        let comunaFinal = formZona.comuna ? String(formZona.comuna).trim() : '';
        if (comunaFinal) {
            const match = COMUNAS_CHILE.find(c => c.toLowerCase() === comunaFinal.toLowerCase());
            if (match) comunaFinal = match; // canonical
            else {
                if (!window.confirm(`Comuna '${comunaFinal}' no reconocida. ¿Guardar igual?`)) return;
            }
        } else {
            comunaFinal = null;
        }
        try {
            await zonasService.crearZona({
                proyecto_id: Number(projectId),
                nombre: formZona.nombre,
                hp: formZona.hp || null,
                direccion: formZona.direccion || null,
                comuna: comunaFinal,
                geo_lat: formZona.lat || null,
                geo_lon: formZona.lon || null
            })
            setShowModal(false)
            loadZonas()
        } catch (err) { alert('Error al crear zona') }
    }

    const handleDeleteZona = async (e, id) => {
        e.stopPropagation()
        if (!window.confirm("¿Eliminar esta zona? Se borrarán sus tramos y cubicaciones.")) return
        try {
            await zonasService.eliminarZona(id)
            loadZonas()
        } catch (err) { alert('Error eliminando zona') }
    }

    // --- HANDLERS TRAMO ---
    const handleAddTramo = async (e) => {
        e.preventDefault()
        if (!newTramoName.trim() || !selectedZona) return
        try {
            await zonasService.crearTramo({
                proyecto_id: Number(projectId),
                zona_id: selectedZona.id,
                nombre: newTramoName
            })
            setNewTramoName('')
            loadTramos(selectedZona.id)
        } catch (err) { alert('Error al crear tramo') }
    }

    const handleDeleteTramo = async (id) => {
        if (!window.confirm("¿Eliminar este tramo?")) return
        try {
            await zonasService.eliminarTramo(id)
            loadTramos(selectedZona.id)
        } catch (err) { alert('Error eliminando tramo') }
    }

    // --- EXCEL IMPORT / EXPORT (Actualizado) ---

    const handleDownloadTemplate = () => {
        const ws_data = [
            ["ID", "Nombre Tramo", "Direccion", "Comuna", "HP", "Latitud", "Longitud"], // Headers
            ["P-101", "Poste A", "Calle 1", "Santiago", "HP-1", "-33.456", "-70.650"],
            ["P-101", "Poste B", "Calle 1", "Santiago", "HP-1", "-33.456", "-70.650"],
            ["Z-200", "", "Rural", "Paine", "", "-33.800", "-70.700"]
        ];

        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wscols = [{ wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Zonas_V3");
        XLSX.writeFile(wb, "Plantilla_Carga_Zonas_Geo.xlsx");
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);

                if (rawData.length === 0 || !('ID' in rawData[0])) {
                    alert("El archivo no tiene la columna 'ID'. Usa la nueva plantilla.");
                    setImporting(false);
                    return;
                }

                const zonasMap = new Map();

                rawData.forEach(row => {
                    const zonaNombreId = row['ID'] ? String(row['ID']).trim() : null;
                    if (!zonaNombreId) return;

                    // AQUÍ ESTÁ LA COLUMNA TRAMO
                    const tramoNombre = row['Nombre Tramo'] ? String(row['Nombre Tramo']).trim() : null;

                    // Datos generales
                    const dir = row['Direccion'] ? String(row['Direccion']).trim() : null;
                    const com = row['Comuna'] ? String(row['Comuna']).trim() : null;
                    const hp = row['HP'] ? String(row['HP']).trim() : null;

                    // Datos Geo
                    const lat = row['Latitud'] ? String(row['Latitud']).trim() : null;
                    const lon = row['Longitud'] ? String(row['Longitud']).trim() : null;

                    if (!zonasMap.has(zonaNombreId)) {
                        zonasMap.set(zonaNombreId, {
                            direccion: dir, comuna: com, hp: hp,
                            geo_lat: lat, geo_lon: lon,
                            tramosSet: new Set()
                        });
                    } else {
                        // Enriquecer si faltaban datos en filas previas
                        const current = zonasMap.get(zonaNombreId);
                        if (!current.direccion && dir) current.direccion = dir;
                        if (!current.comuna && com) current.comuna = com;
                        if (!current.hp && hp) current.hp = hp;
                        if (!current.geo_lat && lat) current.geo_lat = lat;
                        if (!current.geo_lon && lon) current.geo_lon = lon;
                    }

                    if (tramoNombre) zonasMap.get(zonaNombreId).tramosSet.add(tramoNombre);
                });

                const payload = Array.from(zonasMap.entries()).map(([nombreId, data]) => ({
                    nombre: nombreId,
                    direccion: data.direccion,
                    comuna: data.comuna,
                    hp: data.hp,
                    geo_lat: data.geo_lat,
                    geo_lon: data.geo_lon,
                    tramos: Array.from(data.tramosSet)
                }));

                if (payload.length === 0) { alert("Sin datos válidos."); setImporting(false); return; }

                if (!window.confirm(`Importar ${payload.length} Zonas con Geo?`)) { setImporting(false); return; }

                const resultado = await zonasService.importarZonasMasivas(Number(projectId), payload);
                alert(`Procesados: ${resultado.procesados}\nErrores: ${resultado.errores.length}`);

                loadZonas();
                e.target.value = null;

            } catch (error) {
                console.error(error);
                alert("Error procesando Excel.");
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    }

    // --- RENDER ---

    if (loading && zonas.length === 0) return <div className="p-5 text-center"><Spinner animation="border" /></div>

    return (
        <div className="container-fluid py-2 px-3 bg-light min-vh-100">

            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3">

                    <div>
                        <h5 className="fw-bold text-dark mb-0">Zonas y Tramos</h5>
                        <small className="text-muted">Define la geografía del proyecto.</small>
                    </div>
                </div>

                {/* TOOLBAR */}
                <div className="d-flex gap-2">
                    <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />

                    <Button variant="outline-success" size="sm" onClick={handleDownloadTemplate} disabled={importing}>
                        <i className="bi bi-file-earmark-excel me-2"></i>Plantilla Geo
                    </Button>

                    <Button variant="success" size="sm" onClick={() => fileInputRef.current.click()} disabled={importing}>
                        {importing ? <Spinner animation="border" size="sm" /> : <i className="bi bi-upload me-2"></i>}
                        Masiva
                    </Button>
                </div>
            </div>

            <Row className="h-100">

                {/* COLUMNA 1: LISTA DE ZONAS */}
                <Col md={5} lg={4}>
                    <Card className="shadow-sm border-0 h-100 mb-3">
                        <Card.Header className="bg-white py-2 border-bottom d-flex justify-content-between align-items-center">
                            <span className="fw-bold"><i className="bi bi-map me-2 text-primary"></i>Zonas</span>
                            <Button variant="primary" size="sm" onClick={handleOpenModal}>
                                <i className="bi bi-plus-lg"></i> Nueva
                            </Button>
                        </Card.Header>

                        <Card.Body className="p-0 overflow-auto" style={{ maxHeight: '600px' }}>
                            <ListGroup variant="flush">
                                {zonas.length === 0 && <div className="p-4 text-center text-muted small">No hay zonas.</div>}

                                {zonas.map(z => (
                                    <ListGroup.Item
                                        key={z.id}
                                        as="div"
                                        active={selectedZona?.id === z.id}
                                        onClick={() => handleSelectZona(z)}
                                        className="d-flex justify-content-between align-items-center py-2 border-bottom list-group-item-action"
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div>
                                            <span className="fw-medium d-block">{z.nombre}</span>
                                            {/* Indicador visual si tiene Geo */}
                                            {z.geo_lat && z.geo_lon && (
                                                <Badge bg="info" text="dark" className="fw-normal mt-1" style={{ fontSize: '0.65rem' }}>
                                                    <i className="bi bi-geo-alt-fill me-1"></i>Geo
                                                </Badge>
                                            )}
                                        </div>
                                        <Button
                                            variant="link" size="sm"
                                            className={`p-0 ${selectedZona?.id === z.id ? 'text-white opacity-75' : 'text-danger opacity-50'}`}
                                            onClick={(e) => handleDeleteZona(e, z.id)}
                                        >
                                            <i className="bi bi-trash"></i>
                                        </Button>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </Card.Body>
                    </Card>
                </Col>

                {/* COLUMNA 2: DETALLE ZONA */}
                <Col md={7} lg={8}>
                    {selectedZona ? (
                        <Card className="shadow-sm border-0 h-100 animation-fade-in">
                            <Card.Header className="bg-white py-2 border-bottom d-flex justify-content-between align-items-start">
                                <div className="d-flex align-items-start gap-3">
                                    <div className="bg-success bg-opacity-10 p-2 rounded text-success">
                                        <i className="bi bi-signpost-split fs-4"></i>
                                    </div>
                                    <div>
                                        <span className="text-muted small d-block text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
                                            Zona Seleccionada
                                        </span>
                                        <h5 className="fw-bold mb-1 text-dark">{selectedZona.nombre}</h5>

                                        {/* ATRIBUTOS */}
                                        <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                                            {selectedZona.hp && <Badge bg="dark" className="fw-normal font-monospace"><i className="bi bi-qr-code me-1"></i>{selectedZona.hp}</Badge>}
                                            {(selectedZona.direccion || selectedZona.comuna) && (
                                                <div className="text-secondary small">
                                                    <i className="bi bi-geo-alt-fill me-1 text-danger"></i>
                                                    {selectedZona.direccion || ''} {selectedZona.comuna ? `, ${selectedZona.comuna}` : ''}
                                                </div>
                                            )}
                                        </div>

                                        {/* MAPA DE LA ZONA (Si tiene coords) */}
                                        {selectedZona.geo_lat && selectedZona.geo_lon && (
                                            <div className="mt-3 border rounded overflow-hidden" style={{ maxWidth: '300px' }}>
                                                <iframe
                                                    width="100%" height="100" frameBorder="0" style={{ border: 0, display: 'block' }}
                                                    src={`https://maps.google.com/maps?q=${selectedZona.geo_lat},${selectedZona.geo_lon}&z=15&output=embed`}
                                                ></iframe>
                                                <div className="bg-light px-2 py-1 small text-muted text-center border-top">
                                                    Ubicación Planificada
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Badge bg="light" text="dark" className="border px-3 py-2">
                                    {tramos.length} Tramos
                                </Badge>
                            </Card.Header>

                            <Card.Body className="p-0">
                                {/* Formulario Agregar Tramo */}
                                <div className="p-3 bg-light border-bottom">
                                    <Form onSubmit={handleAddTramo}>
                                        <InputGroup>
                                            <InputGroup.Text className="bg-white border-end-0 text-muted small">Nuevo Tramo:</InputGroup.Text>
                                            <Form.Control
                                                placeholder="Ej: Poste 105 al 106..."
                                                value={newTramoName}
                                                onChange={e => setNewTramoName(e.target.value)}
                                            />
                                            <Button variant="success" type="submit">Agregar</Button>
                                        </InputGroup>
                                    </Form>
                                </div>

                                {/* Lista Tramos */}
                                <div className="p-3 overflow-auto" style={{ maxHeight: '400px' }}>
                                    {tramos.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <p>No hay tramos creados.</p>
                                        </div>
                                    ) : (
                                        <Row className="g-2">
                                            {tramos.map(t => (
                                                <Col xs={12} sm={6} key={t.id}>
                                                    <div className="border rounded p-2 d-flex justify-content-between align-items-center bg-white shadow-sm hover-shadow">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <i className="bi bi-geo-alt text-secondary"></i>
                                                            <span className="fw-medium">{t.nombre}</span>
                                                        </div>
                                                        <Button variant="white" size="sm" className="text-danger opacity-50" onClick={() => handleDeleteTramo(t.id)}>
                                                            <i className="bi bi-x-lg"></i>
                                                        </Button>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    )}
                                </div>
                            </Card.Body>
                        </Card>
                    ) : (
                        <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted border rounded-3 bg-white p-5 shadow-sm">
                            <i className="bi bi-arrow-left-circle display-4 mb-3 text-primary opacity-50"></i>
                            <h5 className="fw-normal">Selecciona una Zona</h5>
                            <p className="small">Para ver mapa y tramos.</p>
                        </div>
                    )}
                </Col>
            </Row>

            {/* MODAL CREAR ZONA (NUEVO) */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="h6 fw-bold">Nueva Zona Planificada</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSaveZona}>
                    <Modal.Body>
                        <div className="mb-3">
                            <Form.Label className="small fw-bold">Nombre Zona <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                autoFocus
                                placeholder="Ej: P-1025"
                                value={formZona.nombre}
                                onChange={e => setFormZona({ ...formZona, nombre: e.target.value })}
                            />
                        </div>
                        <Row className="g-2 mb-3">
                            <Col xs={4}>
                                <Form.Label className="small text-muted">HP</Form.Label>
                                <Form.Control size="sm" value={formZona.hp} onChange={e => setFormZona({ ...formZona, hp: e.target.value })} />
                            </Col>
                            <Col xs={8}>
                                <Form.Label className="small text-muted">Comuna</Form.Label>
                                <Form.Control size="sm" list="comunas-chile-list" value={formZona.comuna} onChange={e => setFormZona({ ...formZona, comuna: e.target.value })} />
                                <datalist id="comunas-chile-list">
                                    {COMUNAS_CHILE.map(c => (<option key={c} value={c} />))}
                                </datalist>
                            </Col>
                            <Col xs={12}>
                                <Form.Label className="small text-muted">Dirección</Form.Label>
                                <Form.Control size="sm" value={formZona.direccion} onChange={e => setFormZona({ ...formZona, direccion: e.target.value })} />
                            </Col>
                        </Row>

                        {/* SECCION GEO */}
                        <div className="border-top pt-3">
                            <Form.Label className="small fw-bold text-primary mb-2"><i className="bi bi-geo-alt-fill me-1"></i>Coordenadas Planificadas</Form.Label>
                            <Form.Control
                                size="sm"
                                className="mb-2"
                                placeholder="Pegar Coordenadas (Ej: -33.45, -70.65)"
                                value={formZona.coords}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormZona({ ...formZona, coords: val });
                                    if (val.includes(',')) {
                                        const [l, g] = val.split(',').map(s => s.trim());
                                        if (!isNaN(parseFloat(l)) && !isNaN(parseFloat(g))) {
                                            setFormZona(prev => ({ ...prev, coords: val, lat: l, lon: g }));
                                        }
                                    }
                                }}
                            />
                            <Row className="g-2">
                                <Col xs={6}><Form.Control size="sm" placeholder="Latitud" value={formZona.lat} onChange={e => setFormZona({ ...formZona, lat: e.target.value })} /></Col>
                                <Col xs={6}><Form.Control size="sm" placeholder="Longitud" value={formZona.lon} onChange={e => setFormZona({ ...formZona, lon: e.target.value })} /></Col>
                            </Row>

                            {/* PREVIEW MAPA EN MODAL */}
                            {(formZona.lat && formZona.lon && !isNaN(parseFloat(formZona.lat))) && (
                                <div className="mt-2 border rounded overflow-hidden">
                                    <iframe
                                        width="100%" height="120" frameBorder="0" style={{ border: 0, display: 'block' }}
                                        src={`https://maps.google.com/maps?q=${formZona.lat},${formZona.lon}&z=15&output=embed`}
                                    ></iframe>
                                </div>
                            )}
                        </div>

                    </Modal.Body>
                    <Modal.Footer className="py-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button variant="primary" size="sm" type="submit">Guardar Zona</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

        </div>
    )
}

export default GestionZonas