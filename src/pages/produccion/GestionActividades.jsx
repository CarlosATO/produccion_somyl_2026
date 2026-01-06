import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Modal, Button, Form, Table, Badge, Row, Col, InputGroup, Card } from 'react-bootstrap'
import { actividadesService } from '../../services/actividadesService'
import { cuadrillasService } from '../../services/cuadrillasService'

function GestionActividades() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  // --- ESTADOS DE DATOS ---
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // --- ESTADOS DE MODALS ---
  const [showActividadModal, setShowActividadModal] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [showTarifasModal, setShowTarifasModal] = useState(false)

  // --- ESTADOS DE EDICIÓN ---
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)

  // --- ESTADOS DE SELECCIÓN ---
  const [selectedParent, setSelectedParent] = useState(null) 
  const [selectedItem, setSelectedItem] = useState(null) 
  const [itemType, setItemType] = useState('') 
  
  // --- FORMULARIOS ---
  const [formDataAct, setFormDataAct] = useState({ nombre: '', unidad: 'UN', valor_venta: 0 })
  const [formDataSub, setFormDataSub] = useState({ actividad_id: null, nombre: '', unidad: 'UN', valor_venta: 0 })
  
  // --- TARIFAS ---
  const [tarifas, setTarifas] = useState([]) 
  const [proveedores, setProveedores] = useState([]) 

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await actividadesService.getActividades(projectId)
      setActividades(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- BUSCADOR ---
  const filteredActividades = actividades.map(act => {
    const parentMatch = act.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchingSubs = act.sub_actividades.filter(sub => 
      sub.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    )
    if (parentMatch) return act 
    if (matchingSubs.length > 0) return { ...act, sub_actividades: matchingSubs }
    return null
  }).filter(item => item !== null)


  // =======================================================
  // GESTIÓN DE ACTIVIDADES (PADRES)
  // =======================================================

  const openNewActividad = () => {
    setIsEditing(false)
    setFormDataAct({ nombre: '', unidad: 'UN', valor_venta: 0 })
    setShowActividadModal(true)
  }

  const openEditActividad = (act) => {
    setIsEditing(true)
    setEditId(act.id)
    setFormDataAct({ 
        nombre: act.nombre, 
        unidad: act.unidad, 
        valor_venta: act.valor_venta 
    })
    setShowActividadModal(true)
  }

  const handleSaveActividad = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formDataAct,
        valor_venta: Number(formDataAct.valor_venta) || 0,
        proyecto_id: projectId
      }

      if (isEditing) {
        await actividadesService.actualizarActividad(editId, payload)
      } else {
        await actividadesService.crearActividad(payload)
      }

      setShowActividadModal(false)
      loadData()
    } catch (err) { alert('Error al guardar actividad') }
  }

  const handleDeleteActividad = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de ELIMINAR la actividad: "${nombre}"?\n\nSe borrarán también sus sub-tareas y tarifas.\n(Si ya tiene reportes o pagos asociados, el sistema bloqueará esta acción).`)) return

    try {
      await actividadesService.eliminarActividad(id)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }


  // =======================================================
  // GESTIÓN DE SUB-ACTIVIDADES (HIJOS)
  // =======================================================

  const openNewSub = (actividadPadre) => {
    setSelectedParent(actividadPadre)
    setIsEditing(false)
    setFormDataSub({ actividad_id: actividadPadre.id, nombre: '', unidad: 'UN', valor_venta: 0 })
    setShowSubModal(true)
  }

  const openEditSub = (sub, actividadPadre) => {
    setSelectedParent(actividadPadre)
    setIsEditing(true)
    setEditId(sub.id)
    setFormDataSub({ 
        actividad_id: actividadPadre.id,
        nombre: sub.nombre, 
        unidad: sub.unidad, 
        valor_venta: sub.valor_venta 
    })
    setShowSubModal(true)
  }

  const handleSaveSub = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formDataSub,
        valor_venta: Number(formDataSub.valor_venta) || 0
      }

      if (isEditing) {
        await actividadesService.actualizarSubActividad(editId, payload)
      } else {
        await actividadesService.crearSubActividad(payload)
      }

      setShowSubModal(false)
      loadData()
    } catch (err) { alert('Error al guardar sub-actividad') }
  }

  const handleDeleteSub = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar la tarea: "${nombre}"?`)) return
    try {
      await actividadesService.eliminarSubActividad(id)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }


  // =======================================================
  // GESTIÓN DE TARIFAS (COSTOS)
  // =======================================================

  const openTarifasModal = async (item, type) => {
    setSelectedItem(item)
    setItemType(type)
    setShowTarifasModal(true)
    setTarifas([]) 
    
    // 1. Cargamos Cuadrillas
    const cuadrillas = await cuadrillasService.getCuadrillasProyecto(projectId)
    setProveedores(cuadrillas)

    // 2. Cargamos Tarifas ya guardadas
    const tarifasExistentes = await actividadesService.getTarifas(projectId, item.id, type)
    setTarifas(tarifasExistentes)
  }

  const handleSaveTarifa = async (proveedorId, valor) => {
    if (!valor) return
    try {
      const payload = {
        proyecto_id: Number(projectId),
        proveedor_id: proveedorId,
        valor_costo: Number(valor) || 0
      }
      if (itemType === 'ACT') payload.actividad_id = selectedItem.id
      else payload.sub_actividad_id = selectedItem.id

      await actividadesService.setTarifaSegura(payload)
      
      const updated = await actividadesService.getTarifas(projectId, selectedItem.id, itemType)
      setTarifas(updated)
    } catch (err) { console.error(err) }
  }

  const getTarifaValue = (proveedorId) => {
    const t = tarifas.find(t => t.proveedor.id === proveedorId)
    return t ? t.valor_costo : ''
  }


  // =======================================================
  // RENDER
  // =======================================================
  return (
    <div className="container-fluid py-3 px-4 bg-light min-vh-100">
      
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
        <div className="d-flex align-items-center gap-3">
          <Button 
            variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)}
            className="rounded-circle d-flex align-items-center justify-content-center" style={{width: '32px', height: '32px'}}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h5 className="fw-bold text-dark mb-0">Actividades y Tarifas</h5>
            <small className="text-muted">Gestiona precios de venta y costos por contratista</small>
          </div>
        </div>

        <div className="d-flex gap-2">
          <InputGroup size="sm" style={{ width: '250px' }}>
            <InputGroup.Text className="bg-white border-end-0"><i className="bi bi-search text-muted"></i></InputGroup.Text>
            <Form.Control 
              placeholder="Buscar..." className="border-start-0 ps-0"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          <Button variant="dark" size="sm" className="d-flex align-items-center gap-2 px-3" onClick={openNewActividad}>
            <i className="bi bi-plus-lg"></i> Nueva Actividad
          </Button>
        </div>
      </div>

      {/* LISTA */}
      <div className="row g-2">
        {filteredActividades.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-filter-circle display-6 mb-2 d-block opacity-50"></i>
            No se encontraron actividades.
          </div>
        ) : (
          filteredActividades.map(act => (
            <Col xs={12} key={act.id}>
              <Card className="border shadow-sm overflow-hidden" style={{ borderRadius: '8px' }}>
                
                {/* BARRA ACTIVIDAD PADRE */}
                <div className="d-flex align-items-center bg-light border-bottom py-2 px-3">
                  <div className="me-auto d-flex align-items-center gap-2">
                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill">
                      {act.unidad}
                    </span>
                    <span className="fw-bold text-dark small text-uppercase">{act.nombre}</span>
                    <span className="text-muted small border-start ps-2 ms-1">
                      Venta: <strong>${act.valor_venta}</strong>
                    </span>
                  </div>

                  <div className="d-flex gap-2 align-items-center">
                    
                    {/* --- BOTÓN COSTOS PADRE (Resaltado en Naranja/Amarillo) --- */}
                    <Button 
                        variant="outline-warning" 
                        size="sm" 
                        className="text-dark fw-bold px-2"
                        title="Gestionar Costos / Tarifas" 
                        onClick={() => openTarifasModal(act, 'ACT')}
                    >
                      <i className="bi bi-coin me-1"></i> Costos
                    </Button>

                    <div className="vr opacity-25"></div>

                    {/* Botones de Edición y Subtarea */}
                    <Button variant="outline-secondary" size="sm" className="border-0" title="Editar" onClick={() => openEditActividad(act)}>
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button variant="outline-danger" size="sm" className="border-0" title="Eliminar" onClick={() => handleDeleteActividad(act.id, act.nombre)}>
                      <i className="bi bi-trash"></i>
                    </Button>
                    
                    <Button variant="primary" size="sm" className="ms-2" title="Agregar Sub-Tarea" onClick={() => openNewSub(act)}>
                      <i className="bi bi-plus-circle-fill me-1"></i> Sub-Tarea
                    </Button>
                  </div>
                </div>

                {/* TABLA HIJOS */}
                {act.sub_actividades?.length > 0 && (
                  <Table size="sm" hover className="mb-0 small align-middle">
                    <thead className="text-muted bg-white">
                      <tr>
                        <th style={{width: '20px'}}></th>
                        <th>Sub-Actividad</th>
                        <th style={{width: '80px'}}>Unidad</th>
                        <th style={{width: '120px'}}>Venta</th>
                        <th style={{width: '200px'}} className="text-end pe-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {act.sub_actividades.map(sub => (
                        <tr key={sub.id}>
                          <td className="text-end text-muted"><i className="bi bi-arrow-return-right"></i></td>
                          <td className="fw-medium text-secondary">{sub.nombre}</td>
                          <td><Badge bg="light" text="dark" className="border">{sub.unidad}</Badge></td>
                          <td>${sub.valor_venta}</td>
                          <td className="text-end pe-3">
                            <div className="d-flex justify-content-end gap-1">
                              
                              {/* --- BOTÓN COSTOS HIJO (Resaltado) --- */}
                              <Button 
                                variant="light" 
                                size="sm" 
                                className="text-dark border border-warning px-2 me-2"
                                title="Gestionar Tarifas de Subcontrato"
                                onClick={() => openTarifasModal(sub, 'SUB')} 
                              >
                                <i className="bi bi-coin text-warning me-1"></i> Costos
                              </Button>

                              <Button variant="link" size="sm" className="p-0 text-decoration-none text-secondary me-2" onClick={() => openEditSub(sub, act)} title="Editar">
                                <i className="bi bi-pencil"></i>
                              </Button>
                              <Button variant="link" size="sm" className="p-0 text-decoration-none text-danger" onClick={() => handleDeleteSub(sub.id, sub.nombre)} title="Eliminar">
                                <i className="bi bi-trash"></i>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            </Col>
          ))
        )}
      </div>

      {/* --- MODAL 1: ACTIVIDAD PADRE --- */}
      <Modal show={showActividadModal} onHide={() => setShowActividadModal(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
            <Modal.Title className="h6">{isEditing ? 'Editar Actividad' : 'Nueva Actividad'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveActividad}>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">Nombre</Form.Label>
              <Form.Control size="sm" required type="text" value={formDataAct.nombre} onChange={e => setFormDataAct({...formDataAct, nombre: e.target.value})} />
            </Form.Group>
            <Row>
              <Col xs={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1">Unidad</Form.Label>
                  <Form.Control size="sm" required type="text" value={formDataAct.unidad} onChange={e => setFormDataAct({...formDataAct, unidad: e.target.value})} />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1">Venta ($)</Form.Label>
                  <Form.Control size="sm" required type="number" value={formDataAct.valor_venta} onChange={e => setFormDataAct({...formDataAct, valor_venta: e.target.value})} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="py-1">
            <Button size="sm" variant="primary" type="submit">{isEditing ? 'Guardar Cambios' : 'Crear'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* --- MODAL 2: SUB-ACTIVIDAD --- */}
      <Modal show={showSubModal} onHide={() => setShowSubModal(false)} centered size="sm">
        <Modal.Header closeButton className="py-2 bg-light">
          <div>
            <Modal.Title className="h6 fw-bold">{isEditing ? 'Editar Tarea' : 'Nueva Sub-Actividad'}</Modal.Title>
            <span className="small text-muted d-block">
              De: <strong className="text-primary">{selectedParent?.nombre}</strong>
            </span>
          </div>
        </Modal.Header>
        <Form onSubmit={handleSaveSub}>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">Nombre Tarea</Form.Label>
              <Form.Control size="sm" required type="text" value={formDataSub.nombre} onChange={e => setFormDataSub({...formDataSub, nombre: e.target.value})} />
            </Form.Group>
            <Row>
              <Col xs={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1">Unidad</Form.Label>
                  <Form.Control size="sm" required type="text" value={formDataSub.unidad} onChange={e => setFormDataSub({...formDataSub, unidad: e.target.value})} />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1">Venta ($)</Form.Label>
                  <Form.Control size="sm" type="number" value={formDataSub.valor_venta} onChange={e => setFormDataSub({...formDataSub, valor_venta: e.target.value})} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="py-1">
            <Button size="sm" variant="primary" type="submit">{isEditing ? 'Actualizar' : 'Crear'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* --- MODAL 3: TARIFAS --- */}
      <Modal show={showTarifasModal} onHide={() => setShowTarifasModal(false)} size="lg" centered>
        <Modal.Header closeButton className="py-2 bg-light">
          <div>
            <Modal.Title className="h6 fw-bold">Tarifas por Cuadrilla</Modal.Title>
            <span className="small text-muted">
              Ítem: <strong>{selectedItem?.nombre}</strong>
            </span>
          </div>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="alert alert-warning m-2 py-2 px-3 small border-0 d-flex align-items-center">
            <i className="bi bi-cash-coin fs-4 me-3"></i> 
            <div>
                <strong>Define los Costos de Subcontrato</strong><br/>
                Solo las empresas con tarifa definida podrán reportar esta actividad en sus pagos.
            </div>
          </div>
          <Table hover size="sm" className="mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th className="ps-3">Subcontratista</th>
                <th>RUT</th>
                <th style={{width: '180px'}} className="pe-3 text-end">Costo Pactado ($)</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.length === 0 ? (
                <tr><td colSpan="3" className="text-center py-4 text-muted">No hay cuadrillas habilitadas. Ve a "Cuadrillas" primero.</td></tr>
              ) : (
                proveedores.map(prov => {
                  const valorActual = getTarifaValue(prov.proveedor.id)
                  return (
                    <tr key={prov.id}>
                      <td className="ps-3 fw-medium">{prov.proveedor.nombre}</td>
                      <td className="text-muted">{prov.proveedor.rut}</td>
                      <td className="pe-3">
                        <InputGroup size="sm">
                          <InputGroup.Text className="bg-light border-end-0 text-muted">$</InputGroup.Text>
                          <Form.Control 
                            type="number" 
                            placeholder="0"
                            defaultValue={valorActual}
                            className="border-start-0 text-end fw-bold"
                            onBlur={(e) => {
                                if(e.target.value !== String(valorActual)) {
                                    handleSaveTarifa(prov.proveedor.id, e.target.value)
                                }
                            }}
                          />
                        </InputGroup>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer className="py-1">
          <Button size="sm" variant="secondary" onClick={() => setShowTarifasModal(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

    </div>
  )
}

export default GestionActividades