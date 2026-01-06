import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Modal, Button, Form, Badge, Table, Row, Col, Card } from 'react-bootstrap'
import { cuadrillasService } from '../../services/cuadrillasService'

function GestionCuadrillas() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  
  // --- ESTADOS ---
  const [activeCuadrillas, setActiveCuadrillas] = useState([]) 
  const [availableProviders, setAvailableProviders] = useState([]) 
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [showWorkersModal, setShowWorkersModal] = useState(false)
  
  // Selección
  const [selectedCuadrilla, setSelectedCuadrilla] = useState(null)
  
  // Trabajadores
  const [trabajadores, setTrabajadores] = useState([])
  const [newWorker, setNewWorker] = useState({ nombre_completo: '', rut: '', cargo: '' })

  // --- CARGA INICIAL ---
  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    setLoading(true)
    try {
      const active = await cuadrillasService.getCuadrillasProyecto(projectId)
      setActiveCuadrillas(active)

      const allSubcontratos = await cuadrillasService.getProveedoresSubcontratos()
      const activeIds = active.map(c => c.proveedor.id)
      const disponibles = allSubcontratos.filter(p => !activeIds.includes(p.id))
      
      setAvailableProviders(disponibles)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- ACCIONES ---
  const handleEnableCuadrilla = async (proveedor) => {
    try {
      await cuadrillasService.asignarCuadrilla(projectId, proveedor.id, proveedor.nombre)
      await loadData()
    } catch (err) { alert('Error al habilitar cuadrilla') }
  }

  const handleDesvincular = async (id) => {
    if(!window.confirm("¿Seguro que deseas quitar esta cuadrilla del proyecto?")) return
    try {
      await cuadrillasService.eliminarCuadrilla(id)
      loadData()
    } catch(err) { alert("Error al eliminar") }
  }

  const openWorkersModal = async (cuadrilla) => {
    setSelectedCuadrilla(cuadrilla)
    setShowWorkersModal(true)
    loadWorkers(cuadrilla.id)
  }

  const loadWorkers = async (cuadrillaId) => {
    const data = await cuadrillasService.getTrabajadores(cuadrillaId)
    setTrabajadores(data)
  }

  const handleSaveWorker = async (e) => {
    e.preventDefault()
    if (!newWorker.nombre_completo || !newWorker.rut) return
    try {
      await cuadrillasService.guardarTrabajador({
        ...newWorker,
        cuadrilla_proyecto_id: selectedCuadrilla.id
      })
      setNewWorker({ nombre_completo: '', rut: '', cargo: '' }) 
      loadWorkers(selectedCuadrilla.id)
      loadData() 
    } catch (err) { alert('Error guardando trabajador') }
  }

  const handleDeleteWorker = async (id) => {
    if(!window.confirm("¿Eliminar trabajador?")) return
    await cuadrillasService.eliminarTrabajador(id)
    loadWorkers(selectedCuadrilla.id)
    loadData()
  }

  return (
    <div className="container-fluid py-4 px-4 bg-light min-vh-100">
      
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button 
            variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)}
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{width: '32px', height: '32px'}}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold text-dark">Gestión de Cuadrillas</h3>
            <p className="text-muted mb-0">Administra los subcontratos activos y su personal.</p>
          </div>
        </div>
        <Button 
          variant="primary" 
          className="shadow-sm d-flex align-items-center gap-2"
          onClick={() => setShowCatalogModal(true)}
          style={{ background: '#0f172a', border: 'none' }}
        >
          <i className="bi bi-plus-circle"></i> Habilitar Cuadrilla
        </Button>
      </div>

      {/* LISTA DE CUADRILLAS (TABLA) */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="table-responsive">
          <Table hover className="align-middle mb-0">
            <thead className="bg-light text-muted small text-uppercase">
              <tr>
                <th className="ps-4 py-3">Empresa / Subcontrato</th>
                <th className="py-3">RUT Empresa</th>
                <th className="py-3 text-center">Dotación</th>
                <th className="py-3 text-end pe-4">Gestión</th>
              </tr>
            </thead>
            <tbody>
              {activeCuadrillas.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-5">
                    <div className="text-muted opacity-50 mb-2">
                        <i className="bi bi-people display-4"></i>
                    </div>
                    <h6 className="text-muted">No hay cuadrillas habilitadas</h6>
                    <small className="text-muted">Presiona el botón superior para agregar una.</small>
                  </td>
                </tr>
              ) : (
                activeCuadrillas.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    
                    {/* COL 1: NOMBRE */}
                    <td className="ps-4 py-3">
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded d-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary" 
                             style={{width: '36px', height:'36px', fontSize: '1.2rem'}}>
                           <i className="bi bi-building"></i>
                        </div>
                        <div>
                          <span className="fw-bold text-dark d-block">{item.proveedor?.nombre}</span>
                          <span className="text-muted small">Alias: {item.alias || 'S/A'}</span>
                        </div>
                      </div>
                    </td>

                    {/* COL 2: RUT */}
                    <td className="text-muted font-monospace">{item.proveedor?.rut}</td>

                    {/* COL 3: DOTACIÓN */}
                    <td className="text-center">
                       <Badge bg="light" text="dark" className="border px-3 py-2 rounded-pill">
                          <i className="bi bi-person-fill me-1 text-secondary"></i>
                          {item.total_trabajadores} Trab.
                       </Badge>
                    </td>

                    {/* COL 4: BOTONES */}
                    <td className="text-end pe-4">
                      <div className="d-flex gap-2 justify-content-end">
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="px-3"
                          style={{ borderRadius: '6px' }}
                          onClick={() => openWorkersModal(item)}
                        >
                          <i className="bi bi-people-fill me-2"></i>Trabajadores
                        </Button>
                        
                        <Button 
                          variant="outline-danger" 
                          size="sm" 
                          title="Desvincular del proyecto"
                          style={{ borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444' }}
                          onClick={() => handleDesvincular(item.id)}
                        >
                          <i className="bi bi-x-lg"></i>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>


      {/* --- MODAL 1: CATÁLOGO (SIN CAMBIOS) --- */}
      <Modal show={showCatalogModal} onHide={() => setShowCatalogModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-0">
          <div>
            <Modal.Title className="fw-bold h5">Catálogo de Subcontratistas</Modal.Title>
            <p className="text-muted small mb-0">Selecciona las empresas que trabajarán en este proyecto.</p>
          </div>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="ps-4">Empresa / Razón Social</th>
                  <th>RUT</th>
                  <th className="text-end pe-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {availableProviders.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-4 text-muted">No hay más subcontratistas disponibles.</td></tr>
                ) : (
                  availableProviders.map(prov => (
                    <tr key={prov.id}>
                      <td className="ps-4 fw-medium">{prov.nombre}</td>
                      <td>{prov.rut}</td>
                      <td className="text-end pe-4">
                        <Button variant="primary" size="sm" onClick={() => handleEnableCuadrilla(prov)}>
                          Habilitar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="secondary" onClick={() => setShowCatalogModal(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* --- MODAL 2: TRABAJADORES (SIN CAMBIOS VISUALES MAYORES) --- */}
      <Modal show={showWorkersModal} onHide={() => setShowWorkersModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-light">
          <div>
            <Modal.Title className="fw-bold h5">Nómina de Trabajadores</Modal.Title>
            <small className="text-primary fw-bold">{selectedCuadrilla?.proveedor?.nombre}</small>
          </div>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="p-3 bg-white border-bottom">
            <Form onSubmit={handleSaveWorker} className="row g-2 align-items-end">
              <Col md={4}>
                <Form.Label className="small text-muted mb-1">Nombre Completo</Form.Label>
                <Form.Control size="sm" value={newWorker.nombre_completo} onChange={e => setNewWorker({...newWorker, nombre_completo: e.target.value})} required />
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted mb-1">RUT</Form.Label>
                <Form.Control size="sm" value={newWorker.rut} onChange={e => setNewWorker({...newWorker, rut: e.target.value})} required />
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted mb-1">Cargo</Form.Label>
                <Form.Select size="sm" value={newWorker.cargo} onChange={e => setNewWorker({...newWorker, cargo: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  <option value="Maestro">Maestro</option>
                  <option value="Ayudante">Ayudante</option>
                  <option value="Capataz">Capataz</option>
                  <option value="Jornal">Jornal</option>
                  <option value="Chofer">Chofer</option>
                  <option value="Soldador">Soldador</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Button type="submit" size="sm" variant="success" className="w-100">Agregar</Button>
              </Col>
            </Form>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table hover className="mb-0 align-middle">
              <thead className="table-light sticky-top">
                <tr>
                  <th className="ps-4">Nombre</th>
                  <th>RUT</th>
                  <th>Cargo</th>
                  <th className="text-end pe-4"></th>
                </tr>
              </thead>
              <tbody>
                {trabajadores.map(t => (
                  <tr key={t.id}>
                    <td className="ps-4 fw-medium">{t.nombre_completo}</td>
                    <td>{t.rut}</td>
                    <td><Badge bg="secondary" className="fw-normal">{t.cargo || 'S/D'}</Badge></td>
                    <td className="text-end pe-4">
                      <Button variant="light" size="sm" className="text-danger" onClick={() => handleDeleteWorker(t.id)}>
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default GestionCuadrillas