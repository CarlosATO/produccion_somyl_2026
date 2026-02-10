import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Modal, Button, Form, Table, Badge, Row, Col, InputGroup, Card, Spinner } from 'react-bootstrap'
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
  const [formDataAct, setFormDataAct] = useState({
    nombre: '', unidad: 'UN', valor_venta: 0,
    clasificacion: '', requiere_material: false
  })
  const [formDataSub, setFormDataSub] = useState({
    actividad_id: null, nombre: '', unidad: 'UN', valor_venta: 0, costo_referencia: 0,
    clasificacion: '', requiere_material: false
  })

  // Tarifas
  const [proveedores, setProveedores] = useState([])
  const [tarifasActuales, setTarifasActuales] = useState([])

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await actividadesService.getActividades(projectId)
      setActividades(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // --- HANDLERS ACTIVIDAD (PADRE) ---
  const handleOpenActModal = (act = null) => {
    if (act) {
      setIsEditing(true)
      setEditId(act.id)
      setFormDataAct({
        nombre: act.nombre,
        unidad: act.unidad,
        valor_venta: act.valor_venta,
        clasificacion: act.clasificacion || '',
        requiere_material: act.requiere_material || false
      })
    } else {
      setIsEditing(false)
      setFormDataAct({ nombre: '', unidad: 'UN', valor_venta: 0, clasificacion: '', requiere_material: false })
    }
    setShowActividadModal(true)
  }

  const handleSaveActividad = async (e) => {
    e.preventDefault()
    try {
      if (isEditing) {
        await actividadesService.actualizarActividad(editId, formDataAct)
      } else {
        await actividadesService.crearActividad({ ...formDataAct, proyecto_id: projectId, activo: true })
      }
      setShowActividadModal(false)
      loadData()
    } catch (err) { alert('Error guardando actividad') }
  }

  const handleDeleteActividad = async (id) => {
    if (!window.confirm("¿Eliminar actividad?")) return
    try {
      await actividadesService.eliminarActividad(id)
      loadData()
    } catch (err) { alert(err.message) }
  }

  // --- HANDLERS SUB-ACTIVIDAD (HIJO) ---
  const handleOpenSubModal = (parent, sub = null) => {
    setSelectedParent(parent)
    if (sub) {
      setIsEditing(true)
      setEditId(sub.id)
      setFormDataSub({
        actividad_id: parent.id,
        nombre: sub.nombre,
        unidad: sub.unidad,
        valor_venta: sub.valor_venta,
        costo_referencia: sub.costo_referencia,
        clasificacion: sub.clasificacion || '',
        requiere_material: sub.requiere_material || false
      })
    } else {
      setIsEditing(false)
      setFormDataSub({
        actividad_id: parent.id,
        nombre: '',
        unidad: 'UN',
        valor_venta: 0,
        costo_referencia: 0,
        clasificacion: parent.clasificacion || '',
        requiere_material: parent.requiere_material || false
      })
    }
    setShowSubModal(true)
  }

  const handleSaveSubActividad = async (e) => {
    e.preventDefault()
    try {
      if (isEditing) {
        await actividadesService.actualizarSubActividad(editId, formDataSub)
      } else {
        await actividadesService.crearSubActividad({ ...formDataSub, activo: true })
      }
      setShowSubModal(false)
      loadData()
    } catch (err) { alert('Error guardando sub-actividad') }
  }

  const handleDeleteSubActividad = async (id) => {
    if (!window.confirm("¿Eliminar sub-actividad?")) return
    try {
      await actividadesService.eliminarSubActividad(id)
      loadData()
    } catch (err) { alert(err.message) }
  }

  // --- HANDLERS TARIFAS ---
  const handleOpenTarifas = async (item, type, parentName = '') => {
    setSelectedItem(item)
    setItemType(type)
    try {
      // Protección por si falla el servicio de cuadrillas
      const provs = await cuadrillasService.getCuadrillasProyecto(projectId) || []

      const uniqueProvs = []
      const map = new Map()
      provs.forEach(c => {
        if (c.proveedor && !map.has(c.proveedor.id)) {
          map.set(c.proveedor.id, true)
          uniqueProvs.push(c)
        }
      })
      setProveedores(uniqueProvs)

      const tarifs = await actividadesService.getTarifas(projectId, item.id, type) || []
      setTarifasActuales(tarifs)

      setShowTarifasModal(true)
    } catch (err) {
      console.error("Error cargando tarifas/cuadrillas:", err)
      alert("Error cargando datos de cuadrillas. Revisa la consola.")
    }
  }

  const handleSaveTarifa = async (provId, valor) => {
    try {
      await actividadesService.setTarifaSegura({
        proyecto_id: Number(projectId),
        proveedor_id: provId,
        actividad_id: itemType === 'ACT' ? selectedItem.id : null,
        sub_actividad_id: itemType === 'SUB' ? selectedItem.id : null,
        valor_costo: Number(valor)
      })
      const tarifs = await actividadesService.getTarifas(projectId, selectedItem.id, itemType)
      setTarifasActuales(tarifs)
    } catch (err) { console.error(err); alert("Error guardando tarifa") }
  }

  const getTarifaValue = (provId) => {
    const t = tarifasActuales.find(x => x.proveedor?.id === provId)
    return t ? t.valor_costo : 0
  }

  // --- RENDER ---
  const filteredAct = actividades.filter(a => {
    const term = searchTerm.toLowerCase();
    const nombreMatch = a.nombre?.toLowerCase().includes(term);
    const clasifMatch = a.clasificacion?.toLowerCase().includes(term);
    return nombreMatch || clasifMatch;
  });

  if (loading) return <div className="p-5 text-center"><Spinner animation="border" /></div>

  return (
    <div className="container-fluid py-2 px-3 bg-light min-vh-100">

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">

          <div>
            <h5 className="fw-bold text-dark mb-0">Maestro de Actividades</h5>
            <small className="text-muted">Precios y estructura.</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Form.Control
            size="sm" placeholder="Buscar..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
          <Button variant="primary" size="sm" onClick={() => handleOpenActModal()}>
            <i className="bi bi-plus-lg me-2"></i>Nueva Actividad
          </Button>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="shadow-sm border-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="bg-light">
            <tr>
              <th className="border-0 ps-3 py-2 text-secondary small">NOMBRE</th>
              <th className="border-0 py-2 text-secondary small">CLASIFICACIÓN</th>
              <th className="border-0 py-2 text-center text-secondary small">UNIDAD</th>
              <th className="border-0 py-2 text-end text-secondary small">PRECIO VENTA</th>
              <th className="border-0 py-2 text-center text-secondary small">REQ. MAT.</th>
              <th className="border-0 py-2 text-end pe-3 text-secondary small">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filteredAct.map(act => (
              <React.Fragment key={act.id}>
                {/* FILA PADRE */}
                <tr className="bg-white">
                  <td className="ps-3 py-1.5 fw-bold text-dark">
                    {act.nombre}
                    {act.sub_actividades?.length > 0 && <Badge bg="light" text="dark" className="ms-2 border" style={{ fontSize: '0.65rem' }}>{act.sub_actividades.length} Subs</Badge>}
                  </td>
                  <td className="py-1.5">
                    {act.clasificacion ? (
                      <Badge bg="secondary" className="bg-opacity-10 text-secondary border fw-normal" style={{ fontSize: '0.65rem' }}>
                        {act.clasificacion}
                      </Badge>
                    ) : <span className="text-muted small">-</span>}
                  </td>
                  <td className="text-center py-1.5"><Badge bg="light" text="dark" className="border" style={{ fontSize: '0.65rem' }}>{act.unidad}</Badge></td>
                  <td className="text-end py-1.5 fw-bold text-success" style={{ fontSize: '0.85rem' }}>${act.valor_venta.toLocaleString()}</td>
                  <td className="text-center py-1.5">
                    {act.requiere_material ?
                      <i className="bi bi-box-seam-fill text-primary" title="Requiere Materiales"></i> :
                      <span className="text-muted opacity-25"><i className="bi bi-dash-lg"></i></span>
                    }
                  </td>
                  <td className="text-end pe-3 py-1.5">
                    <div className="d-flex justify-content-end gap-1">
                      <Button variant="outline-primary" size="sm" onClick={() => handleOpenSubModal(act)} title="Agregar Sub-Actividad"><i className="bi bi-diagram-2"></i></Button>
                      <Button variant="outline-success" size="sm" onClick={() => handleOpenTarifas(act, 'ACT')} title="Gestionar Tarifas"><i className="bi bi-currency-dollar"></i></Button>
                      <Button variant="outline-secondary" size="sm" onClick={() => handleOpenActModal(act)} title="Editar"><i className="bi bi-pencil"></i></Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleDeleteActividad(act.id)}><i className="bi bi-trash"></i></Button>
                    </div>
                  </td>
                </tr>

                {/* FILAS HIJAS */}
                {act.sub_actividades?.map(sub => (
                  <tr key={sub.id} className="bg-light bg-opacity-25">
                    <td className="ps-5 small">
                      <i className="bi bi-arrow-return-right text-muted me-2"></i>{sub.nombre}
                    </td>
                    <td>
                      {sub.clasificacion ? (
                        <Badge bg="light" className="text-muted border fw-normal" style={{ fontSize: '0.7em' }}>
                          {sub.clasificacion}
                        </Badge>
                      ) : (
                        <span className="text-muted small opacity-50">-</span>
                      )}
                    </td>
                    <td className="text-center small text-muted">{sub.unidad}</td>
                    <td className="text-end small font-monospace">${sub.valor_venta.toLocaleString()}</td>
                    <td className="text-center">
                      {sub.requiere_material ?
                        <i className="bi bi-box-seam-fill text-primary small" title="Requiere Materiales"></i> :
                        ''
                      }
                    </td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-1">
                        <Button variant="link" className="text-success p-0 px-1" onClick={() => handleOpenTarifas(sub, 'SUB', act.nombre)}><i className="bi bi-currency-dollar"></i></Button>
                        <Button variant="link" className="text-secondary p-0 px-1" onClick={() => handleOpenSubModal(act, sub)}><i className="bi bi-pencil"></i></Button>
                        <Button variant="link" className="text-danger p-0 px-1" onClick={() => handleDeleteSubActividad(sub.id)}><i className="bi bi-trash"></i></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* MODAL ACTIVIDAD (PADRE) */}
      <Modal show={showActividadModal} onHide={() => setShowActividadModal(false)} backdrop="static" centered>
        <Modal.Header closeButton><Modal.Title>{isEditing ? 'Editar' : 'Nueva'} Actividad</Modal.Title></Modal.Header>
        <Form onSubmit={handleSaveActividad}>
          <Modal.Body>
            <Row className="g-2">
              <Col md={12}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Nombre</Form.Label>
                  <Form.Control autoFocus required type="text" value={formDataAct.nombre} onChange={e => setFormDataAct({ ...formDataAct, nombre: e.target.value })} />
                </Form.Group>
              </Col>

              <Col md={8}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Clasificación</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej: Obras Civiles, Ferretería..."
                    value={formDataAct.clasificacion}
                    onChange={e => setFormDataAct({ ...formDataAct, clasificacion: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-center pt-3">
                <Form.Check
                  type="switch"
                  id="check-mat-act"
                  label="Reporta Material?"
                  className="fw-bold small text-primary"
                  checked={formDataAct.requiere_material}
                  onChange={e => setFormDataAct({ ...formDataAct, requiere_material: e.target.checked })}
                />
              </Col>

              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Unidad</Form.Label>
                  <Form.Select value={formDataAct.unidad} onChange={e => setFormDataAct({ ...formDataAct, unidad: e.target.value })}>
                    <option value="UN">UN (Unidad)</option>
                    <option value="M">M (Metros)</option>
                    <option value="M2">M2 (Metros Cuadrados)</option>
                    <option value="M3">M3 (Metros Cúbicos)</option>
                    <option value="GL">GL (Global)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Precio Venta ($)</Form.Label>
                  <Form.Control type="number" value={formDataAct.valor_venta} onChange={e => setFormDataAct({ ...formDataAct, valor_venta: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowActividadModal(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL SUB-ACTIVIDAD (HIJO) */}
      <Modal show={showSubModal} onHide={() => setShowSubModal(false)} backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6">
            {isEditing ? 'Editar' : 'Agregar'} Sub-Item a <span className="text-primary">{selectedParent?.nombre}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveSubActividad}>
          <Modal.Body>
            <Row className="g-2">
              <Col md={12}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Nombre Sub-Actividad</Form.Label>
                  <Form.Control autoFocus required type="text" value={formDataSub.nombre} onChange={e => setFormDataSub({ ...formDataSub, nombre: e.target.value })} />
                </Form.Group>
              </Col>

              <Col md={8}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Clasificación</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej: Cableado..."
                    value={formDataSub.clasificacion}
                    onChange={e => setFormDataSub({ ...formDataSub, clasificacion: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-center pt-3">
                <Form.Check
                  type="switch"
                  id="check-mat-sub"
                  label="Reporta Material?"
                  className="fw-bold small text-primary"
                  checked={formDataSub.requiere_material}
                  onChange={e => setFormDataSub({ ...formDataSub, requiere_material: e.target.checked })}
                />
              </Col>

              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Unidad</Form.Label>
                  <Form.Select value={formDataSub.unidad} onChange={e => setFormDataSub({ ...formDataSub, unidad: e.target.value })}>
                    <option value="UN">UN</option>
                    <option value="M">M</option>
                    <option value="M2">M2</option>
                    <option value="GL">GL</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-bold">Precio Venta ($)</Form.Label>
                  <Form.Control type="number" value={formDataSub.valor_venta} onChange={e => setFormDataSub({ ...formDataSub, valor_venta: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <div className="p-2 bg-warning bg-opacity-10 rounded border border-warning">
                  <Form.Label className="small fw-bold mb-0">Costo Referencia (Interno)</Form.Label>
                  <Form.Control size="sm" type="number" value={formDataSub.costo_referencia} onChange={e => setFormDataSub({ ...formDataSub, costo_referencia: e.target.value })} />
                  <Form.Text className="text-muted x-small">Solo para estimaciones, no afecta cobros.</Form.Text>
                </div>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSubModal(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL TARIFAS */}
      <Modal show={showTarifasModal} onHide={() => setShowTarifasModal(false)} centered>
        <Modal.Header closeButton><Modal.Title className="h6">Gestionar Tarifas: <span className="fw-bold">{selectedItem?.nombre}</span></Modal.Title></Modal.Header>
        <Modal.Body className="p-0">
          <Table striped hover size="sm" className="mb-0">
            <thead className="bg-light">
              <tr><th className="ps-3">Subcontratista</th><th>RUT</th><th className="text-end pe-3">Tarifa Pactada ($)</th></tr>
            </thead>
            <tbody>
              {proveedores.length === 0 ? <tr><td colSpan="3" className="text-center p-3">No hay cuadrillas asignadas al proyecto.</td></tr> : (
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
                              if (e.target.value !== String(valorActual)) {
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