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
    if (!window.confirm("¿Seguro que deseas quitar esta cuadrilla del proyecto?")) return
    try {
      await cuadrillasService.eliminarCuadrilla(id)
      loadData()
    } catch (err) { alert("Error al eliminar") }
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
    if (!window.confirm("¿Eliminar trabajador?")) return
    await cuadrillasService.eliminarTrabajador(id)
    loadWorkers(selectedCuadrilla.id)
    loadData()
  }

  return (
    <div className="container-fluid py-2 px-3 bg-light min-vh-100">

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-3">

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
                <th className="ps-3 py-2">Empresa / Subcontrato</th>
                <th className="py-2">RUT Empresa</th>
                <th className="py-2 text-center">Dotación</th>
                <th className="py-2 text-end pe-3">Gestión</th>
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
                    <td className="ps-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded d-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary"
                          style={{ width: '32px', height: '32px', fontSize: '1.1rem' }}>
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
                    <td className="text-end pe-3">
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

      {/* --- MODAL 2: TRABAJADORES (MEJORADO) --- */}
      <Modal show={showWorkersModal} onHide={() => setShowWorkersModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-gradient" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }}>
          <div>
            <Modal.Title className="fw-bold h5 text-white d-flex align-items-center gap-2">
              <i className="bi bi-people-fill"></i>
              Nómina de Trabajadores
            </Modal.Title>
            <small className="text-white opacity-75">{selectedCuadrilla?.proveedor?.nombre}</small>
          </div>
        </Modal.Header>
        <Modal.Body className="p-0">
          {/* FORMULARIO AGREGAR */}
          <div className="p-4 bg-light border-bottom">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-person-plus-fill text-success fs-5"></i>
              <span className="fw-bold text-dark">Agregar Nuevo Integrante</span>
            </div>
            <Form onSubmit={handleSaveWorker}>
              <Row className="g-3 align-items-end">
                <Col md={4}>
                  <Form.Label className="small fw-bold text-muted mb-1">
                    <i className="bi bi-person me-1"></i>Nombre Completo
                  </Form.Label>
                  <Form.Control
                    placeholder="Ej: Juan Pérez Soto"
                    value={newWorker.nombre_completo}
                    onChange={e => setNewWorker({ ...newWorker, nombre_completo: e.target.value })}
                    required
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="small fw-bold text-muted mb-1">
                    <i className="bi bi-card-text me-1"></i>RUT
                  </Form.Label>
                  <Form.Control
                    placeholder="12.345.678-9"
                    value={newWorker.rut}
                    onChange={e => setNewWorker({ ...newWorker, rut: e.target.value })}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="small fw-bold text-muted mb-1">
                    <i className="bi bi-briefcase me-1"></i>Cargo
                  </Form.Label>
                  <Form.Select value={newWorker.cargo} onChange={e => setNewWorker({ ...newWorker, cargo: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    <optgroup label="👷 Operaciones">
                      <option value="Capataz">Capataz</option>
                      <option value="Maestro">Maestro</option>
                      <option value="Ayudante">Ayudante</option>
                      <option value="Jornal">Jornal</option>
                    </optgroup>
                    <optgroup label="🔧 Especialistas">
                      <option value="Soldador">Soldador</option>
                      <option value="Electricista">Electricista</option>
                      <option value="Mecánico">Mecánico</option>
                      <option value="Operador Maquinaria">Operador Maquinaria</option>
                    </optgroup>
                    <optgroup label="📐 Técnicos">
                      <option value="Dibujante">Dibujante</option>
                      <option value="Topógrafo">Topógrafo</option>
                      <option value="Técnico Eléctrico">Técnico Eléctrico</option>
                      <option value="Técnico FTTH">Técnico FTTH</option>
                    </optgroup>
                    <optgroup label="🚗 Transporte">
                      <option value="Chofer">Chofer</option>
                      <option value="Gruero">Gruero</option>
                    </optgroup>
                    <optgroup label="📋 Supervisión">
                      <option value="Supervisor">Supervisor</option>
                      <option value="Jefe de Cuadrilla">Jefe de Cuadrilla</option>
                      <option value="Prevencionista">Prevencionista</option>
                    </optgroup>
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Button type="submit" variant="success" className="w-100 shadow-sm">
                    <i className="bi bi-plus-lg me-1"></i>Agregar
                  </Button>
                </Col>
              </Row>
            </Form>
          </div>

          {/* LISTA DE TRABAJADORES */}
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {trabajadores.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-people display-4 opacity-25"></i>
                <p className="mt-2 mb-0">No hay trabajadores registrados</p>
                <small>Agrega integrantes usando el formulario superior</small>
              </div>
            ) : (
              <Table hover className="mb-0 align-middle">
                <thead className="table-light sticky-top">
                  <tr>
                    <th className="ps-4" style={{ width: '40%' }}>Nombre</th>
                    <th style={{ width: '25%' }}>RUT</th>
                    <th style={{ width: '25%' }}>Cargo</th>
                    <th className="text-end pe-4" style={{ width: '10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadores.map(t => (
                    <tr key={t.id}>
                      <td className="ps-4">
                        <div className="d-flex align-items-center gap-2">
                          <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                            <i className="bi bi-person-fill text-primary"></i>
                          </div>
                          <span className="fw-medium">{t.nombre_completo}</span>
                        </div>
                      </td>
                      <td className="font-monospace text-muted">{t.rut || '—'}</td>
                      <td>
                        <Badge
                          bg={
                            ['Capataz', 'Supervisor', 'Jefe de Cuadrilla'].includes(t.cargo) ? 'primary' :
                              ['Dibujante', 'Topógrafo', 'Técnico Eléctrico', 'Técnico FTTH'].includes(t.cargo) ? 'info' :
                                ['Soldador', 'Electricista', 'Mecánico'].includes(t.cargo) ? 'warning' :
                                  'secondary'
                          }
                          className="fw-normal px-2 py-1"
                        >
                          {t.cargo || 'Sin cargo'}
                        </Badge>
                      </td>
                      <td className="text-end pe-4">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="rounded-circle p-0"
                          style={{ width: '28px', height: '28px' }}
                          onClick={() => handleDeleteWorker(t.id)}
                          title="Eliminar trabajador"
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light border-top py-2">
          <div className="d-flex align-items-center justify-content-between w-100">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Total: <strong>{trabajadores.length}</strong> trabajador{trabajadores.length !== 1 ? 'es' : ''}
            </small>
            <Button variant="secondary" size="sm" onClick={() => setShowWorkersModal(false)}>
              Cerrar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default GestionCuadrillas