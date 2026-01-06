import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Modal, Button, Form, Table, Badge, InputGroup, Spinner } from 'react-bootstrap'
import { actividadesService } from '../../services/actividadesService'
import { cubicacionService } from '../../services/cubicacionService'

function Cubicacion() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  
  // Data
  const [actividades, setActividades] = useState([])
  const [zonas, setZonas] = useState([])
  const [cubicaciones, setCubicaciones] = useState([]) // Array plano de la BD

  // Modal Zona
  const [showZonaModal, setShowZonaModal] = useState(false)
  const [newZonaName, setNewZonaName] = useState('')

  useEffect(() => {
    loadAllData()
  }, [projectId])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [acts, zons, cubs] = await Promise.all([
        actividadesService.getActividades(projectId),
        cubicacionService.getZonas(projectId),
        cubicacionService.getCubicaciones(projectId)
      ])
      setActividades(acts)
      setZonas(zons)
      setCubicaciones(cubs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGICA DE ZONAS ---
  const handleAddZona = async (e) => {
    e.preventDefault()
    if(!newZonaName) return
    try {
      await cubicacionService.crearZona({ proyecto_id: projectId, nombre: newZonaName })
      setNewZonaName('')
      setShowZonaModal(false)
      // Recargar solo zonas
      const zons = await cubicacionService.getZonas(projectId)
      setZonas(zons)
    } catch (err) { alert('Error al crear zona') }
  }

  const handleDeleteZona = async (id) => {
    if(!window.confirm("¿Borrar esta zona? Se perderán las cantidades asignadas a ella.")) return
    try {
      await cubicacionService.eliminarZona(id)
      const zons = await cubicacionService.getZonas(projectId)
      setZonas(zons)
    } catch(err) { alert('Error al eliminar zona') }
  }

  // --- LOGICA DE MATRIZ (Visualización) ---
  
  // Función para encontrar el valor en el array plano 'cubicaciones'
  const getCantidad = (zonaId, itemId, type) => {
    const found = cubicaciones.find(c => {
      if (c.zona_id !== zonaId) return false
      if (type === 'ACT') return c.actividad_id === itemId
      if (type === 'SUB') return c.sub_actividad_id === itemId
      return false
    })
    return found ? found.cantidad : 0
  }

  // Función para guardar al salir del input (onBlur)
  const handleSaveCell = async (val, zonaId, item, type) => {
    const cantidad = Number(val) || 0
    // Optimización: Si el valor no cambió respecto al estado actual, no hacer nada (faltaría implementar check previo)
    
    try {
      const payload = {
        proyecto_id: Number(projectId),
        zona_id: zonaId,
        cantidad: cantidad
      }
      if (type === 'ACT') payload.actividad_id = item.id
      else payload.sub_actividad_id = item.id

      await cubicacionService.guardarCubicacion(payload)
      
      // Actualizar estado local para que el Total se recalcule sin recargar toda la página
      // (Una actualización optimista o fetch silencioso sería mejor, aquí haremos fetch simple)
      const newCubs = await cubicacionService.getCubicaciones(projectId)
      setCubicaciones(newCubs)
      
    } catch (err) { console.error("Error guardando celda", err) }
  }

  // Calculadora de Totales por Fila
  const getTotalFila = (itemId, type) => {
    // Filtramos todas las cubicaciones que coincidan con este item
    const matches = cubicaciones.filter(c => {
      if (type === 'ACT') return c.actividad_id === itemId
      if (type === 'SUB') return c.sub_actividad_id === itemId
      return false
    })
    // Sumamos sus cantidades
    return matches.reduce((sum, curr) => sum + Number(curr.cantidad), 0)
  }


  if (loading) return <div className="p-5 text-center"><Spinner animation="border" /></div>

  return (
    <div className="container-fluid py-3 px-4 bg-light min-vh-100">
      
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
        <div className="d-flex align-items-center gap-3">
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)} className="rounded-circle" style={{width:'32px', height:'32px'}}>
                <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
                <h5 className="fw-bold text-dark mb-0">Matriz de Cubicación</h5>
                <small className="text-muted">Distribución de cantidades por zona.</small>
            </div>
        </div>
        <div>
            <Button variant="primary" size="sm" onClick={() => setShowZonaModal(true)}>
                <i className="bi bi-layout-three-columns me-2"></i>Nueva Zona (Columna)
            </Button>
        </div>
      </div>

      {/* TABLA MATRIZ CON SCROLL HORIZONTAL */}
      <div className="table-responsive shadow-sm bg-white rounded border">
        <Table bordered hover size="sm" className="mb-0 align-middle small" style={{ minWidth: '100%' }}>
            
            {/* CABECERA (ZONAS) */}
            <thead className="bg-light">
                <tr>
                    <th className="bg-light sticky-start" style={{minWidth: '250px', left: 0, zIndex: 5}}>Ítem / Actividad</th>
                    <th className="bg-light text-center" style={{width: '80px'}}>Precio</th>
                    <th className="bg-light text-center table-active border-end border-start border-3" style={{width: '90px'}}>TOTAL</th>
                    
                    {/* COLUMNAS DINÁMICAS DE ZONAS */}
                    {zonas.map(z => (
                        <th key={z.id} className="text-center position-relative group-hover" style={{minWidth: '100px'}}>
                            <div className="d-flex justify-content-between align-items-center px-1">
                                <span className="fw-bold text-dark mx-auto">{z.nombre}</span>
                                <i 
                                    className="bi bi-x-circle-fill text-danger opacity-25 ms-1" 
                                    style={{cursor:'pointer', fontSize: '0.8rem'}}
                                    title="Borrar Zona"
                                    onClick={() => handleDeleteZona(z.id)}
                                    onMouseEnter={(e) => e.target.classList.replace('opacity-25', 'opacity-100')}
                                    onMouseLeave={(e) => e.target.classList.replace('opacity-100', 'opacity-25')}
                                ></i>
                            </div>
                        </th>
                    ))}
                    {zonas.length === 0 && <th className="text-muted fst-italic fw-normal text-center">Agrega una zona...</th>}
                </tr>
            </thead>

            {/* CUERPO (ACTIVIDADES) */}
            <tbody>
                {actividades.map(act => (
                  <React.Fragment key={act.id}>
                        {/* FILA PADRE */}
                        <tr key={`act-${act.id}`} className="bg-light bg-opacity-50">
                            <td className="fw-bold text-primary sticky-start bg-white" style={{left: 0}}>
                                {act.nombre} <Badge bg="light" text="dark" className="border ms-1">{act.unidad}</Badge>
                            </td>
                            <td className="text-end text-muted font-monospace">${act.valor_venta}</td>
                            
                            {/* TOTAL CALCULADO */}
                            <td className="text-end fw-bold bg-warning bg-opacity-10 border-end border-start border-3 font-monospace">
                                {getTotalFila(act.id, 'ACT')}
                            </td>

                            {/* CELDAS PADRE (Solo editables si NO tiene hijos, o si decidimos permitir ambos) */}
                            {/* En tu requerimiento: "Si tiene sub actividad sera una pequeña rama". Asumiremos que si tiene hijos, el padre NO se cubica directamente, o sí? */}
                            {/* Flexibilidad total: Permitimos cubicar padre siempre. */}
                            {zonas.map(z => {
                                const val = getCantidad(z.id, act.id, 'ACT')
                                return (
                                    <td key={z.id} className="p-0">
                                        <input 
                                            type="number" 
                                            className="form-control form-control-sm border-0 text-end bg-transparent shadow-none"
                                            placeholder="-"
                                            defaultValue={val || ''}
                                            onBlur={(e) => handleSaveCell(e.target.value, z.id, act, 'ACT')}
                                        />
                                    </td>
                                )
                            })}
                            {zonas.length === 0 && <td className="bg-light"></td>}
                        </tr>

                        {/* FILAS HIJAS (SUB-ACTIVIDADES) */}
                        {act.sub_actividades?.map(sub => (
                          <tr key={`sub-${sub.id}`}>
                                <td className="ps-4 sticky-start bg-white" style={{left: 0}}>
                                    <i className="bi bi-arrow-return-right text-muted me-2"></i>
                                    {sub.nombre} <span className="text-muted small">({sub.unidad})</span>
                                </td>
                                <td className="text-end text-muted small font-monospace">${sub.valor_venta}</td>
                                
                                {/* TOTAL HIJO */}
                                <td className="text-end fw-bold bg-light border-end border-start border-3 font-monospace">
                                    {getTotalFila(sub.id, 'SUB')}
                                </td>

                                {/* CELDAS HIJO */}
                                {zonas.map(z => {
                                    const val = getCantidad(z.id, sub.id, 'SUB')
                                    return (
                                        <td key={z.id} className="p-0">
                                            <input 
                                                type="number" 
                                                className="form-control form-control-sm border-0 text-end shadow-none"
                                                placeholder="-"
                                                style={{fontSize: '0.9rem'}}
                                                defaultValue={val || ''}
                                                onBlur={(e) => handleSaveCell(e.target.value, z.id, sub, 'SUB')}
                                            />
                                        </td>
                                    )
                                })}
                                {zonas.length === 0 && <td></td>}
                            </tr>
                        ))}
                    </React.Fragment>
                ))}
            </tbody>
        </Table>
      </div>

      {/* MODAL CREAR ZONA */}
      <Modal show={showZonaModal} onHide={() => setShowZonaModal(false)} size="sm" centered>
        <Modal.Header closeButton><Modal.Title className="h6">Nueva Zona</Modal.Title></Modal.Header>
        <Form onSubmit={handleAddZona}>
            <Modal.Body>
                <Form.Label>Nombre de la Zona</Form.Label>
                <Form.Control 
                    autoFocus 
                    placeholder="Ej: Zona Norte, A-1" 
                    value={newZonaName} 
                    onChange={e => setNewZonaName(e.target.value)} 
                />
            </Modal.Body>
            <Modal.Footer>
                <Button size="sm" variant="primary" type="submit">Crear Columna</Button>
            </Modal.Footer>
        </Form>
      </Modal>

    </div>
  )
}

export default Cubicacion