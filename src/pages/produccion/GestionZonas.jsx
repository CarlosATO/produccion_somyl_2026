import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Form, Card, ListGroup, Row, Col, Badge, InputGroup, Spinner } from 'react-bootstrap'
import { zonasService } from '../../services/zonasService'

function GestionZonas() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  
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
      // Si ya había una seleccionada, refrescamos sus tramos también
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
    setTramos([]) // Limpiar previo
    loadTramos(zona.id)
  }

  const handleAddZona = async (e) => {
    e.preventDefault()
    if (!newZonaName.trim()) return
    try {
      // CORRECCIÓN: Aseguramos que el ID sea numérico
      await zonasService.crearZona({ 
        proyecto_id: Number(projectId), 
        nombre: newZonaName 
      })
      setNewZonaName('')
      loadZonas()
    } catch (err) { alert('Error al crear zona') }
  }

  const handleDeleteZona = async (e, id) => {
    e.stopPropagation() // Para que no seleccione la zona al borrar
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
      // CORRECCIÓN: Aseguramos IDs numéricos
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

  if (loading && zonas.length === 0) return <div className="p-5 text-center"><Spinner animation="border" /></div>

  return (
    <div className="container-fluid py-3 px-4 bg-light min-vh-100">
      
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div className="d-flex align-items-center gap-3">
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)} className="rounded-circle" style={{width:'32px', height:'32px'}}>
                <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
                <h5 className="fw-bold text-dark mb-0">Zonas y Tramos</h5>
                <small className="text-muted">Define la geografía del proyecto para asignar tareas.</small>
            </div>
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
                                /* CORRECCIÓN REACT: Quitamos 'action' y usamos 'as="div"' para evitar <button> dentro de <button> */
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
                    <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-signpost-split text-success fs-5"></i>
                            <div>
                                <span className="text-muted small d-block">Gestionando Tramos en:</span>
                                <h6 className="fw-bold mb-0 text-dark">{selectedZona.nombre}</h6>
                            </div>
                        </div>
                        <Badge bg="light" text="dark" className="border">{tramos.length} Tramos</Badge>
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
                </div>
            )}
        </Col>
      </Row>
    </div>
  )
}

export default GestionZonas