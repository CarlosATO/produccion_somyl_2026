import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Form, Row, Col, Badge, Card, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { format, parseISO } from 'date-fns'

import { descuentosService } from '../../services/descuentosService'
import { cuadrillasService } from '../../services/cuadrillasService'

function GestionDescuentos() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // Datos
  const [descuentos, setDescuentos] = useState([])
  const [cuadrillasOpts, setCuadrillasOpts] = useState([])

  // Filtros
  const [filterProv, setFilterProv] = useState(null)
  const [filterDateRange, setFilterDateRange] = useState([null, null])
  const [startDate, endDate] = filterDateRange
  const [filterEstado, setFilterEstado] = useState({ value: 'TODOS', label: 'Todos los Estados' })

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [isLocked, setIsLocked] = useState(false) // Si está cobrado, se bloquea
  const [lockedInfo, setLockedInfo] = useState(null) // Info del EP donde se cobró

  const [form, setForm] = useState({
    proveedor_id: null,
    fecha: new Date(),
    tipo: 'ANTICIPO',
    monto: '',
    descripcion: ''
  })

  // Opciones
  const estadoOpts = [
    { value: 'TODOS', label: 'Todos los Estados' },
    { value: 'PENDIENTE', label: 'Pendientes (Sin Cobrar)' },
    { value: 'APLICADO', label: 'Aplicados (Cobrados)' }
  ]

  useEffect(() => { loadData() }, [projectId])

  const loadData = async () => {
    try {
      const [d, c] = await Promise.all([
        descuentosService.getDescuentos(projectId),
        cuadrillasService.getCuadrillasProyecto(projectId)
      ])
      setDescuentos(d)
      setCuadrillasOpts(c.map(x => ({ value: x.proveedor.id, label: x.proveedor.nombre })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // --- FILTROS ---
  const filteredDescuentos = useMemo(() => {
    return descuentos.filter(d => {
      if (filterProv && d.proveedor_id !== filterProv.value) return false
      if (startDate && endDate) {
        const dDate = parseISO(d.fecha)
        if (dDate < startDate || dDate > endDate) return false
      }
      if (filterEstado.value !== 'TODOS') {
        const isAplicado = !!d.estado_pago_id
        if (filterEstado.value === 'PENDIENTE' && isAplicado) return false
        if (filterEstado.value === 'APLICADO' && !isAplicado) return false
      }
      return true
    })
  }, [descuentos, filterProv, startDate, endDate, filterEstado])

  // --- ACTIONS ---

  const handleOpenCreate = () => {
    setIsEditing(false)
    setIsLocked(false)
    setLockedInfo(null)
    setForm({ proveedor_id: null, fecha: new Date(), tipo: 'ANTICIPO', monto: '', descripcion: '' })
    setShowModal(true)
  }

  const handleOpenEdit = (item) => {
    setIsEditing(true)
    setEditingId(item.id)

    // Verificar si está bloqueado (Ya cobrado)
    const locked = !!item.estado_pago_id
    setIsLocked(locked)
    setLockedInfo(item.estado_pago) // Guardamos info del EP

    setForm({
      proveedor_id: cuadrillasOpts.find(c => c.value === item.proveedor_id),
      fecha: parseISO(item.fecha),
      tipo: item.tipo,
      monto: item.monto,
      descripcion: item.descripcion || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) { setShowModal(false); return; } // Solo cierre si es lectura

    if (!form.proveedor_id || !form.monto) return alert("Faltan datos")

    const payload = {
      proyecto_id: projectId,
      proveedor_id: form.proveedor_id.value,
      fecha: form.fecha,
      tipo: form.tipo,
      monto: Number(form.monto),
      descripcion: form.descripcion
    }

    try {
      if (isEditing) {
        await descuentosService.actualizarDescuento(editingId, payload)
      } else {
        await descuentosService.crearDescuento(payload)
      }
      setShowModal(false)
      loadData()
    } catch (err) { alert("Error al guardar") }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation() // Evitar abrir el modal al hacer click en borrar
    if (!window.confirm("¿Eliminar este registro permanentemente?")) return
    try {
      await descuentosService.eliminarDescuento(id)
      loadData()
    } catch (err) { alert("Error eliminando") }
  }

  // --- RENDER ---
  return (
    <div className="container-fluid p-4 bg-white min-vh-100">

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">

          <div><h4 className="fw-bold mb-0 text-dark">Cargos y Descuentos</h4><small className="text-muted">Libro de Novedades Financieras.</small></div>
        </div>
        <Button variant="danger" onClick={handleOpenCreate} className="shadow-sm"><i className="bi bi-dash-circle me-2"></i>Registrar Cargo</Button>
      </div>

      {/* FILTROS */}
      <Card className="mb-4 border-0 shadow-sm bg-light">
        <Card.Body className="py-3">
          <Row className="g-3 align-items-center">
            <Col md="auto" className="fw-bold text-muted small text-uppercase"><i className="bi bi-funnel-fill me-1"></i> Filtros:</Col>
            <Col md={3}><Select options={cuadrillasOpts} value={filterProv} onChange={setFilterProv} placeholder="Todos los Subcontratos..." isClearable className="text-start" /></Col>
            <Col md={3}><DatePicker selectsRange={true} startDate={startDate} endDate={endDate} onChange={(update) => setFilterDateRange(update)} placeholderText="Rango de Fechas..." className="form-control" dateFormat="dd/MM/yyyy" isClearable /></Col>
            <Col md={3}><Select options={estadoOpts} value={filterEstado} onChange={setFilterEstado} isSearchable={false} /></Col>
            <Col className="text-end"><small className="text-muted">Registros: <strong>{filteredDescuentos.length}</strong></small></Col>
          </Row>
        </Card.Body>
      </Card>

      {/* TABLA INTERACTIVA */}
      <Card className="shadow-sm border-0">
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light text-secondary">
              <tr>
                <th className="ps-4 border-0">Fecha</th>
                <th className="border-0">Subcontratista</th>
                <th className="border-0">Tipo</th>
                <th className="border-0">Descripción</th>
                <th className="text-end border-0">Monto</th>
                <th className="text-center border-0">Estado</th>
                <th className="text-end pe-4 border-0">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDescuentos.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-5 text-muted">No hay registros.</td></tr>
              ) : (
                filteredDescuentos.map(d => (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenEdit(d)} title="Click para ver detalle">
                    <td className="ps-4 text-muted small">{format(parseISO(d.fecha), 'dd/MM/yyyy')}</td>
                    <td className="fw-bold text-dark">{d.proveedor?.nombre}</td>
                    <td><Badge bg="secondary" className="fw-normal bg-opacity-75">{d.tipo}</Badge></td>
                    <td><small className="text-muted text-truncate d-block" style={{ maxWidth: '250px' }}>{d.descripcion}</small></td>
                    <td className="text-end fw-bold text-danger" style={{ fontFamily: 'monospace', fontSize: '1rem' }}>- ${Number(d.monto).toLocaleString()}</td>
                    <td className="text-center">
                      {d.estado_pago_id ? (
                        <Badge bg="success" className="fw-normal"><i className="bi bi-check-circle-fill me-1"></i>Cobrado</Badge>
                      ) : (
                        <Badge bg="warning" text="dark" className="fw-normal"><i className="bi bi-hourglass-split me-1"></i>Pendiente</Badge>
                      )}
                    </td>
                    <td className="text-end pe-4">
                      {!d.estado_pago_id ? (
                        // Si está pendiente, se puede borrar
                        <Button variant="link" className="text-danger p-0" onClick={(e) => handleDelete(e, d.id)}>
                          <i className="bi bi-trash"></i>
                        </Button>
                      ) : (
                        // Si está cobrado, ícono de candado
                        <OverlayTrigger overlay={<Tooltip>Cargo aplicado en EP. No se puede borrar.</Tooltip>}>
                          <i className="bi bi-lock-fill text-muted"></i>
                        </OverlayTrigger>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* MODAL PROFESIONAL */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered backdrop="static" size="lg">
        {/* CABECERA DIFERENTE SEGÚN ESTADO */}
        <Modal.Header closeButton className={isLocked ? "bg-success bg-opacity-10 border-success" : "bg-white border-0"}>
          <Modal.Title className={`h5 fw-bold ${isLocked ? 'text-success' : 'text-dark'}`}>
            {isLocked ? (
              <span><i className="bi bi-check-circle-fill me-2"></i>Detalle de Cargo Aplicado</span>
            ) : (
              <span>{isEditing ? 'Editar Cargo' : 'Registrar Nuevo Cargo'}</span>
            )}
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleSubmit}>
          <Modal.Body className="px-4 py-3">

            {/* ALERT SI ESTÁ COBRADO */}
            {isLocked && lockedInfo && (
              <div className="alert alert-success d-flex align-items-center shadow-sm mb-4">
                <i className="bi bi-info-circle-fill fs-4 me-3"></i>
                <div>
                  <strong>Este cargo ya fue procesado.</strong>
                  <div className="small">Se descontó en el Estado de Pago: <strong>{lockedInfo.codigo}</strong> ({lockedInfo.estado})</div>
                </div>
              </div>
            )}

            <Row className="g-3">
              {/* 1. SUBCONTRATISTA (Bloqueado si editamos o locked) */}
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Subcontratista Afectado</Form.Label>
                  <Select
                    options={cuadrillasOpts}
                    placeholder="Seleccione..."
                    value={form.proveedor_id}
                    onChange={(val) => setForm({ ...form, proveedor_id: val })}
                    isDisabled={isLocked} // Bloqueado si ya se cobró
                    styles={{ control: (base) => ({ ...base, borderColor: '#dee2e6' }) }}
                  />
                </Form.Group>
              </Col>

              {/* 2. DATOS DEL CARGO */}
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Fecha del Evento</Form.Label>
                  <DatePicker
                    selected={form.fecha}
                    onChange={(date) => setForm({ ...form, fecha: date })}
                    className="form-control"
                    dateFormat="dd/MM/yyyy"
                    disabled={isLocked}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Tipo de Movimiento</Form.Label>
                  <Form.Select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    disabled={isLocked}
                    className="fw-semibold text-dark"
                  >
                    <option value="ANTICIPO">Anticipo de Dinero</option>
                    <option value="MULTA">Multa / Sanción</option>
                    <option value="EPP">Costo de EPP / Herramientas</option>
                    <option value="EXAMENES">Exámenes / Cursos</option>
                    <option value="ERROR">Error en Producción</option>
                    <option value="OTRO">Otro</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              {/* 3. MONTO DESTACADO */}
              <Col md={12}>
                <div className="p-3 bg-light rounded border mt-2">
                  <Form.Label className="small fw-bold text-muted mb-1">Monto a Descontar</Form.Label>
                  <InputGroup size="lg">
                    <InputGroup.Text className="bg-danger text-white border-danger fw-bold">- $</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={form.monto}
                      onChange={(e) => setForm({ ...form, monto: e.target.value })}
                      placeholder="0"
                      className="fw-bold text-danger bg-white"
                      disabled={isLocked}
                      required
                    />
                  </InputGroup>
                  <Form.Text className="text-muted small">
                    {isLocked
                      ? "El monto no se puede cambiar porque ya fue facturado."
                      : "Este monto se reflejará como negativo en el próximo Estado de Pago."}
                  </Form.Text>
                </div>
              </Col>

              {/* 4. DESCRIPCIÓN */}
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Detalle / Justificación</Form.Label>
                  <Form.Control
                    as="textarea" rows={3}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Describa la razón del cargo..."
                    disabled={isLocked}
                    className="bg-light"
                  />
                </Form.Group>
              </Col>
            </Row>

          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="link" className="text-secondary text-decoration-none" onClick={() => setShowModal(false)}>
              {isLocked ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!isLocked && (
              <Button variant="danger" type="submit" className="px-4 shadow-sm">
                {isEditing ? 'Guardar Cambios' : 'Confirmar Cargo'}
              </Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
  )
}

export default GestionDescuentos