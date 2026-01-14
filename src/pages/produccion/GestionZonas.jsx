import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Form, Card, ListGroup, Row, Col, Badge, InputGroup, Spinner, Alert } from 'react-bootstrap'
import * as XLSX from 'xlsx' // Importamos la librería
import { zonasService } from '../../services/zonasService'

function GestionZonas() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null) // Referencia al input oculto

  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  
  // Data
  const [zonas, setZonas] = useState([])
  const [tramos, setTramos] = useState([])

  // UI State
  const [selectedZona, setSelectedZona] = useState(null)
  
  // Forms
  const [newZonaName, setNewZonaName] = useState('')
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
         if(stillExists) loadTramos(selectedZona.id)
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

  const handleAddZona = async (e) => {
    e.preventDefault()
    if (!newZonaName.trim()) return
    try {
      await zonasService.crearZona({ 
        proyecto_id: Number(projectId), 
        nombre: newZonaName 
      })
      setNewZonaName('')
      loadZonas()
    } catch (err) { alert('Error al crear zona') }
  }

  const handleDeleteZona = async (e, id) => {
    e.stopPropagation() 
    if(!window.confirm("¿Eliminar esta zona? Se borrarán sus tramos y cubicaciones.")) return
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
    } catch (err) { 
        console.error(err)
        alert('Error al crear tramo') 
    }
  }

  const handleDeleteTramo = async (id) => {
    if(!window.confirm("¿Eliminar este tramo?")) return
    try {
      await zonasService.eliminarTramo(id)
      loadTramos(selectedZona.id)
    } catch (err) { alert('Error eliminando tramo') }
  }

    // --- EXCEL IMPORT / EXPORT ACTUALIZADO ---

    const handleDownloadTemplate = () => {
        // 1. Definir datos de ejemplo basados en la NUEVA estructura solicitada
        const ws_data = [
            ["ID", "Nombre Tramo", "Direccion", "Comuna", "HP"], // Nuevos encabezados
            ["P-102030", "Poste de inicio", "Av. Principal 123", "Santiago", "HP-Norte-01"],
            ["P-102030", "Derivación A", "Av. Principal 123", "Santiago", "HP-Norte-01"],
            ["Z-500B", "", "Camino Rural S/N", "Paine", ""], // Zona sin tramo y sin HP
            ["Z-999X", "Tramo Único", "", "", "HP-X99"] // Zona solo con HP
        ];
    
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        // Ajustar ancho de columnas para que se vea bien
        const wscols = [ {wch:15}, {wch:20}, {wch:25}, {wch:15}, {wch:15} ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Zonas_V2");
        XLSX.writeFile(wb, "Plantilla_Carga_Zonas_Atributos.xlsx");
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

                // 1. Validar columna principal "ID" (que usaremos como Nombre de Zona)
                if (rawData.length === 0 || !('ID' in rawData[0])) {
                         alert("El archivo no tiene la columna 'ID' requerida. Por favor descarga la nueva plantilla.");
                         setImporting(false);
                         return;
                }

                // 2. Nueva Lógica de Agrupación Inteligente
                // Usamos un Map donde la clave es el Nombre de la Zona (ID del excel)
                // Y el valor es un objeto con sus metadatos y un Set de sus tramos.
                const zonasMap = new Map();

                rawData.forEach((row, index) => {
                        // Limpiamos los datos de entrada
                        const zonaNombreId = row['ID'] ? String(row['ID']).trim() : null;
                        const tramoNombre = row['Nombre Tramo'] ? String(row['Nombre Tramo']).trim() : null;

                        // Nuevos campos (opcionales)
                        const dir = row['Direccion'] ? String(row['Direccion']).trim() : null;
                        const com = row['Comuna'] ? String(row['Comuna']).trim() : null;
                        const hp = row['HP'] ? String(row['HP']).trim() : null;

                        if (!zonaNombreId) return; // Saltamos filas sin ID de zona

                        if (!zonasMap.has(zonaNombreId)) {
                                // Primera vez que vemos esta Zona: Inicializamos su estructura
                                zonasMap.set(zonaNombreId, {
                                        direccion: dir,
                                        comuna: com,
                                        hp: hp,
                                        tramosSet: new Set()
                                });
                        } else {
                                // Ya existe la zona. Intentamos enriquecer los metadatos si faltaban en filas anteriores.
                                // Esto es útil si la primera fila de la zona tenía la dirección vacía pero la segunda no.
                                const currentData = zonasMap.get(zonaNombreId);
                                if (!currentData.direccion && dir) currentData.direccion = dir;
                                if (!currentData.comuna && com) currentData.comuna = com;
                                if (!currentData.hp && hp) currentData.hp = hp;
                        }

                        // Siempre intentamos agregar el tramo si existe en esta fila
                        if (tramoNombre) {
                                zonasMap.get(zonaNombreId).tramosSet.add(tramoNombre);
                        }
                });

                // 3. Transformar el Map al formato que espera el servicio
                const payload = Array.from(zonasMap.entries()).map(([nombreId, data]) => ({
                        nombre: nombreId, // La columna "ID" del Excel pasa a ser el "nombre" en la BD
                        direccion: data.direccion,
                        comuna: data.comuna,
                        hp: data.hp,
                        tramos: Array.from(data.tramosSet) // Convertimos el Set a Array
                }));

                if (payload.length === 0) {
                        alert("No se encontraron datos válidos para importar.");
                        setImporting(false);
                        return;
                }

                if(!window.confirm(`Se han detectado ${payload.length} Zonas únicas con sus atributos y tramos. ¿Proceder con la importación?`)) {
                        setImporting(false);
                        return;
                }

                // 4. Enviar al servicio
                const resultado = await zonasService.importarZonasMasivas(Number(projectId), payload);
        
                let msg = `Importación finalizada.\nCorrectos: ${resultado.procesados}\nFallidos: ${resultado.errores.length}`;
                if (resultado.errores.length > 0) {
                        msg += "\n\nRevisa la consola para ver el detalle de los errores.";
                        console.error("Detalle de errores de importación:", resultado.errores);
                }
                alert(msg);

                loadZonas();
                e.target.value = null; // Limpiar input file

            } catch (error) {
                console.error("Error crítico procesando Excel:", error);
                alert(`Error al procesar el archivo: ${error.message}`);
            } finally {
                setImporting(false);
            }
        };
    
        reader.readAsBinaryString(file);
    }
  // --- RENDER ---

  if (loading && zonas.length === 0) return <div className="p-5 text-center"><Spinner animation="border" /></div>

  return (
    <div className="container-fluid py-3 px-4 bg-light min-vh-100">
      
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)} className="rounded-circle" style={{width:'32px', height:'32px'}}>
                <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
                <h5 className="fw-bold text-dark mb-0">Zonas y Tramos</h5>
                <small className="text-muted">Define la geografía del proyecto para asignar tareas.</small>
            </div>
        </div>

        {/* TOOLBAR IMPORTACIÓN */}
        <div className="d-flex gap-2">
            <input 
                type="file" 
                accept=".xlsx, .xls" 
                style={{display: 'none'}} 
                ref={fileInputRef}
                onChange={handleFileUpload}
            />
            
            <Button variant="outline-success" size="sm" onClick={handleDownloadTemplate} disabled={importing}>
                <i className="bi bi-file-earmark-excel me-2"></i>Descargar Plantilla
            </Button>
            
            <Button variant="success" size="sm" onClick={() => fileInputRef.current.click()} disabled={importing}>
                {importing ? <Spinner animation="border" size="sm" className="me-2"/> : <i className="bi bi-upload me-2"></i>}
                {importing ? 'Importando...' : 'Carga Masiva Excel'}
            </Button>
        </div>
      </div>

      <Row className="h-100">
        
        {/* COLUMNA 1: LISTA DE ZONAS */}
        <Col md={5} lg={4}>
            <Card className="shadow-sm border-0 h-100 mb-4">
                <Card.Header className="bg-white py-3 fw-bold border-bottom">
                    <i className="bi bi-map me-2 text-primary"></i>1. Zonas del Proyecto
                </Card.Header>
                <Card.Body className="d-flex flex-column p-0">
                    
                    {/* Formulario Agregar Zona */}
                    <div className="p-3 bg-light border-bottom">
                        <Form onSubmit={handleAddZona}>
                            <InputGroup size="sm">
                                <Form.Control 
                                    placeholder="Nombre zona... (Ej: Zona Norte)" 
                                    value={newZonaName}
                                    onChange={e => setNewZonaName(e.target.value)}
                                />
                                <Button variant="primary" type="submit"><i className="bi bi-plus-lg"></i></Button>
                            </InputGroup>
                        </Form>
                    </div>

                    {/* Lista Zonas */}
                    <div className="overflow-auto" style={{maxHeight: '600px'}}>
                        <ListGroup variant="flush">
                            {zonas.length === 0 && <div className="p-4 text-center text-muted small">No hay zonas creadas.</div>}
                            
                            {zonas.map(z => (
                                <ListGroup.Item 
                                    key={z.id} 
                                    as="div" 
                                    active={selectedZona?.id === z.id}
                                    onClick={() => handleSelectZona(z)}
                                    className="d-flex justify-content-between align-items-center py-3 border-bottom list-group-item-action"
                                    style={{cursor: 'pointer'}} 
                                >
                                    <span className="fw-medium">{z.nombre}</span>
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
                    </div>
                </Card.Body>
            </Card>
        </Col>

        {/* COLUMNA 2: TRAMOS DE LA ZONA SELECCIONADA */}
        <Col md={7} lg={8}>
            {selectedZona ? (
                <Card className="shadow-sm border-0 h-100 animation-fade-in">
                    {/* --- AQUÍ ESTÁ EL CAMBIO PRINCIPAL --- */}
                    <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-start">
                        <div className="d-flex align-items-start gap-3">
                            <div className="bg-success bg-opacity-10 p-2 rounded text-success">
                                <i className="bi bi-signpost-split fs-4"></i>
                            </div>
                            <div>
                                <span className="text-muted small d-block text-uppercase fw-bold mb-1" style={{fontSize: '0.7rem'}}>
                                    Zona Seleccionada
                                </span>
                                <h5 className="fw-bold mb-1 text-dark">{selectedZona.nombre}</h5>
                                
                                {/* MOSTRAR ATRIBUTOS SI EXISTEN */}
                                <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                                    {selectedZona.hp && (
                                        <Badge bg="dark" text="white" className="fw-normal font-monospace">
                                            <i className="bi bi-qr-code me-1"></i>{selectedZona.hp}
                                        </Badge>
                                    )}
                                    {(selectedZona.direccion || selectedZona.comuna) && (
                                        <div className="text-secondary small">
                                            <i className="bi bi-geo-alt-fill me-1 text-danger"></i>
                                            {selectedZona.direccion || ''} 
                                            {selectedZona.direccion && selectedZona.comuna ? ', ' : ''}
                                            {selectedZona.comuna || ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Badge bg="light" text="dark" className="border px-3 py-2">
                            {tramos.length} Tramos
                        </Badge>
                    </Card.Header>
                    {/* --- FIN DEL CAMBIO --- */}
                    
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

                        {/* Lista de Tramos (Grid) */}
                        <div className="p-3 overflow-auto" style={{maxHeight: '600px'}}>
                            {tramos.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-cone-striped display-4 text-muted opacity-25 mb-3 d-block"></i>
                                    <p className="text-muted">No hay tramos en esta zona.</p>
                                    <small className="text-muted">Agrega uno arriba para comenzar a asignar tareas.</small>
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
                                                <Button 
                                                    variant="white" size="sm" 
                                                    className="text-danger opacity-50"
                                                    onClick={() => handleDeleteTramo(t.id)}
                                                    title="Eliminar Tramo"
                                                >
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
                /* ESTADO VACÍO (Ninguna zona seleccionada) */
                <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted border rounded-3 bg-white p-5 shadow-sm">
                    <i className="bi bi-arrow-left-circle display-4 mb-3 text-primary opacity-50"></i>
                    <h5 className="fw-normal">Selecciona una Zona</h5>
                    <p className="small">Haz clic en una zona del panel izquierdo para ver y gestionar sus tramos.</p>
                    <p className="small text-muted mt-2 fst-italic">💡 Tip: Usa el botón "Carga Masiva" arriba a la derecha para subir tu Excel.</p>
                </div>
            )}
        </Col>
      </Row>
    </div>
  )
}

export default GestionZonas