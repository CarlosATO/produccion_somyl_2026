import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Modal, Button, Form, Table, Badge, Spinner, Row, Col, InputGroup } from 'react-bootstrap'
import * as XLSX from 'xlsx'
import { actividadesService } from '../../services/actividadesService'
import { cubicacionService } from '../../services/cubicacionService'
import { zonasService } from '../../services/zonasService'

import COMUNAS_CHILE from '../../data/comunasChile'

function Cubicacion() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)

  // --- DATOS ---
  const [actividades, setActividades] = useState([])
  const [zonas, setZonas] = useState([])
  const [cubicaciones, setCubicaciones] = useState([])

  // --- FILTROS ---
  const [filterZona, setFilterZona] = useState('')
  const [filterActividad, setFilterActividad] = useState('')
  const [hideEmptyZonas, setHideEmptyZonas] = useState(false)

  // --- MODAL NUEVA ZONA ---
  const [showZonaModal, setShowZonaModal] = useState(false)
  const [formZona, setFormZona] = useState({ nombre: '', hp: '', direccion: '', comuna: '', tramos: '' })

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
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // ==========================================
  //  LÓGICA DE FILTRADO
  // ==========================================
  const filteredZonas = useMemo(() => {
    let result = zonas;
    if (filterZona.trim()) {
      const term = filterZona.toLowerCase();
      result = result.filter(z =>
        z.nombre.toLowerCase().includes(term) ||
        (z.hp && z.hp.toLowerCase().includes(term)) ||
        (z.direccion && z.direccion.toLowerCase().includes(term)) ||
        (z.comuna && z.comuna.toLowerCase().includes(term))
      );
    }
    if (hideEmptyZonas) {
      result = result.filter(z => cubicaciones.some(c => c.zona_id === z.id && Number(c.cantidad) > 0))
    }
    return result;
  }, [zonas, filterZona, hideEmptyZonas, cubicaciones]);

  const filteredActividades = useMemo(() => {
    if (!filterActividad.trim()) return actividades;
    const term = filterActividad.toLowerCase();

    return actividades.reduce((acc, act) => {
      const parentMatch = act.nombre.toLowerCase().includes(term);
      const matchingSubs = act.sub_actividades?.filter(sub =>
        sub.nombre.toLowerCase().includes(term)
      ) || [];

      if (parentMatch) {
        acc.push(act);
      } else if (matchingSubs.length > 0) {
        acc.push({ ...act, sub_actividades: matchingSubs });
      }
      return acc;
    }, []);
  }, [actividades, filterActividad]);

  // ==========================================
  //  MANEJO DE DATOS Y CELDAS
  // ==========================================
  const getCantidad = (zonaId, itemId, type) => {
    const found = cubicaciones.find(c => {
      if (c.zona_id !== zonaId) return false
      if (type === 'ACT') return c.actividad_id === itemId
      if (type === 'SUB') return c.sub_actividad_id === itemId
      return false
    })
    return found ? found.cantidad : 0
  }

  const handleSaveCell = async (val, zonaId, item, type) => {
    const cantidad = Number(val) || 0
    try {
      const payload = {
        proyecto_id: Number(projectId),
        zona_id: zonaId,
        cantidad: cantidad
      }
      if (type === 'ACT') payload.actividad_id = item.id
      else payload.sub_actividad_id = item.id

      await cubicacionService.guardarCubicacion(payload)
      const newCubs = await cubicacionService.getCubicaciones(projectId)
      setCubicaciones(newCubs)
    } catch (err) { console.error("Error guardando celda", err) }
  }

  const getTotalFila = (itemId, type) => {
    const matches = cubicaciones.filter(c => {
      if (type === 'ACT') return c.actividad_id === itemId
      if (type === 'SUB') return c.sub_actividad_id === itemId
      return false
    })
    return matches.reduce((sum, curr) => sum + Number(curr.cantidad), 0)
  }

  // ==========================================
  //  EXPORTAR A EXCEL
  // ==========================================
  const handleExportExcel = () => {
    if (filteredZonas.length === 0) {
      alert("No hay zonas visibles para exportar.");
      return;
    }
    const ws_data = [];

    // Fila 1: Headers principales
    const headers = ["ÍTEM / ACTIVIDAD", "UNIDAD", "PRECIO UNITARIO", "TOTAL CANTIDAD", "TOTAL $"];
    filteredZonas.forEach(z => {
      // Construir header de zona con nombre + dirección + comuna
      let zonaHeader = z.nombre;
      const detalles = [];
      if (z.hp) detalles.push(z.hp);
      if (z.direccion) detalles.push(z.direccion);
      if (z.comuna) detalles.push(z.comuna);
      if (detalles.length > 0) {
        zonaHeader += `\n(${detalles.join(' | ')})`;
      }
      headers.push(zonaHeader);
    });
    ws_data.push(headers);

    filteredActividades.forEach(act => {
      const totalCant = getTotalFila(act.id, 'ACT');
      const totalPlata = totalCant * act.valor_venta;
      const row = [act.nombre, act.unidad, act.valor_venta, totalCant, totalPlata];
      filteredZonas.forEach(z => row.push(getCantidad(z.id, act.id, 'ACT')));
      ws_data.push(row);

      act.sub_actividades?.forEach(sub => {
        const subTotalCant = getTotalFila(sub.id, 'SUB');
        const subTotalPlata = subTotalCant * sub.valor_venta;
        const subRow = [`   ↳ ${sub.nombre}`, sub.unidad, sub.valor_venta, subTotalCant, subTotalPlata];
        filteredZonas.forEach(z => subRow.push(getCantidad(z.id, sub.id, 'SUB')));
        ws_data.push(subRow);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Configurar anchos de columna
    const wscols = [{ wch: 45 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    filteredZonas.forEach(() => wscols.push({ wch: 25 })); // Más ancho para mostrar dirección
    ws['!cols'] = wscols;

    // Configurar altura de fila de headers para texto multilínea
    ws['!rows'] = [{ hpt: 40 }]; // Primera fila más alta

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz Cubicación");
    XLSX.writeFile(wb, `Cubicacion_Proyecto_${projectId}.xlsx`);
  }

  // --- MANEJO DE MODAL ZONA ---
  const handleOpenModal = () => {
    setFormZona({ nombre: '', hp: '', direccion: '', comuna: '', tramos: '' })
    setShowZonaModal(true)
  }
  const handleAddZona = async (e) => {
    e.preventDefault()
    if (!formZona.nombre.trim()) return
    try {
      const zonaPayload = { proyecto_id: projectId, nombre: formZona.nombre, hp: formZona.hp || null, direccion: formZona.direccion || null, comuna: formZona.comuna || null }
      const nuevaZona = await zonasService.crearZona(zonaPayload)
      if (formZona.tramos && formZona.tramos.trim().length > 0) {
        const listaTramos = formZona.tramos.split('\n').map(t => t.trim()).filter(t => t.length > 0)
        if (listaTramos.length > 0) {
          await Promise.all(listaTramos.map(nt => zonasService.crearTramo({ proyecto_id: Number(projectId), zona_id: nuevaZona.id, nombre: nt })))
        }
      }
      setShowZonaModal(false)
      const zons = await cubicacionService.getZonas(projectId)
      setZonas(zons)
    } catch (err) { alert('Error creando zona') }
  }
  const handleDeleteZona = async (id) => {
    if (!window.confirm("¿Borrar zona?")) return
    try { await cubicacionService.eliminarZona(id); setZonas(await cubicacionService.getZonas(projectId)); } catch (err) { alert('Error') }
  }

  // ==========================================
  //  ESTILOS TABLA - COLUMNAS FIJAS Y BORDES
  // ==========================================
  const COL_WIDTHS = {
    ITEM: 280,
    PRECIO: 80,
    TOTAL: 90
  };

  // Estilo base para celdas del BODY (columnas fijas)
  const cellSticky = (leftPos) => ({
    position: 'sticky',
    left: leftPos,
    backgroundColor: '#fff',
    zIndex: 2
  });

  // Estilo para columna TOTAL en el body (borde derecho fuerte)
  const cellStickyTotal = {
    position: 'sticky',
    left: COL_WIDTHS.ITEM + COL_WIDTHS.PRECIO,
    backgroundColor: '#fffbeb', // Amarillo muy suave
    zIndex: 2,
    borderRight: '3px solid #6c757d'
  };

  // Estilo base para celdas del HEADER (columnas fijas)
  const headerSticky = (leftPos) => ({
    position: 'sticky',
    left: leftPos,
    top: 0,
    backgroundColor: '#f8f9fa',
    zIndex: 4
  });

  // Estilo para header TOTAL (esquina importante)
  const headerStickyTotal = {
    position: 'sticky',
    left: COL_WIDTHS.ITEM + COL_WIDTHS.PRECIO,
    top: 0,
    backgroundColor: '#ffc107',
    color: '#000',
    zIndex: 5,
    borderRight: '3px solid #6c757d'
  };

  if (loading) return <div className="p-5 text-center"><Spinner animation="border" /></div>

  return (
    <div className="container-fluid py-2 px-3 bg-light min-vh-100 d-flex flex-column">

      {/* HEADER & TITULO */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex align-items-center gap-3">

          <div>
            <h5 className="fw-bold text-dark mb-0">Matriz de Cubicación</h5>
            <small className="text-muted">Gestión de cantidades por zona y actividad.</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button variant="success" size="sm" onClick={handleExportExcel} className="shadow-sm">
            <i className="bi bi-file-earmark-spreadsheet me-2"></i>Exportar Excel
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenModal} className="shadow-sm">
            <i className="bi bi-layout-three-columns me-2"></i>Nueva Zona
          </Button>
        </div>
      </div>

      {/* BARRA DE HERRAMIENTAS */}
      <div className="card border-0 shadow-sm mb-2 p-2 bg-white rounded-3">
        <Row className="g-3 align-items-center">
          <Col md={4}>
            <InputGroup>
              <InputGroup.Text className="bg-light border-end-0 text-primary"><i className="bi bi-list-task"></i></InputGroup.Text>
              <Form.Control size="sm" placeholder="Filtrar Actividad..." value={filterActividad} onChange={(e) => setFilterActividad(e.target.value)} className="border-start-0 bg-light" />
              {filterActividad && <Button variant="outline-secondary" onClick={() => setFilterActividad('')}><i className="bi bi-x"></i></Button>}
            </InputGroup>
          </Col>
          <Col md={1} className="text-center d-none d-md-block text-muted"><i className="bi bi-x-lg"></i></Col>
          <Col md={4}>
            <InputGroup>
              <InputGroup.Text className="bg-light border-end-0 text-success"><i className="bi bi-view-list"></i></InputGroup.Text>
              <Form.Control size="sm" placeholder="Buscar Zona, HP, Comuna..." value={filterZona} onChange={(e) => setFilterZona(e.target.value)} className="border-start-0 bg-light" />
              {filterZona && <Button variant="outline-secondary" onClick={() => setFilterZona('')}><i className="bi bi-x"></i></Button>}
            </InputGroup>
          </Col>
          <Col md={3} className="text-end">
            <div className="d-flex align-items-center justify-content-end gap-3">
              <Form.Check type="switch" id="hide-empty" label={<span className="small text-muted">Con datos</span>} checked={hideEmptyZonas} onChange={(e) => setHideEmptyZonas(e.target.checked)} />
              <Badge bg="secondary" className="fw-normal">{filteredZonas.length} / {zonas.length} Zonas</Badge>
            </div>
          </Col>
        </Row>
      </div>

      {/* TABLA DE DATOS */}
      <div className="table-responsive shadow-sm bg-white rounded border flex-grow-1" style={{ maxHeight: '70vh' }}>
        <Table bordered size="sm" className="mb-0 align-middle" style={{ fontSize: '0.8rem' }}>

          {/* CABECERA */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr className="bg-light">
              {/* COL 1: ITEM */}
              <th style={{ ...headerSticky(0), width: COL_WIDTHS.ITEM, minWidth: COL_WIDTHS.ITEM }} className="align-middle">
                Ítem / Actividad
                {filterActividad && <Badge bg="primary" pill className="ms-2" style={{ fontSize: '0.65rem' }}>Filtrado</Badge>}
              </th>

              {/* COL 2: PRECIO */}
              <th style={{ ...headerSticky(COL_WIDTHS.ITEM), width: COL_WIDTHS.PRECIO }} className="text-center align-middle">
                Precio
              </th>

              {/* COL 3: TOTAL */}
              <th style={{ ...headerStickyTotal, width: COL_WIDTHS.TOTAL }} className="text-center align-middle fw-bold">
                TOTAL
              </th>

              {/* ZONAS DINÁMICAS */}
              {filteredZonas.map(z => (
                <th key={z.id} className="text-center bg-white align-top" style={{ minWidth: 120, maxWidth: 150, padding: '8px 6px' }}>
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <span className="fw-bold small text-dark text-start" style={{ lineHeight: 1.2 }}>{z.nombre}</span>
                    <i
                      className="bi bi-x-circle text-danger opacity-50 ms-1"
                      style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                      onClick={() => handleDeleteZona(z.id)}
                      title="Eliminar"
                    ></i>
                  </div>
                  {z.hp && <Badge bg="secondary" className="mb-1 fw-normal" style={{ fontSize: '0.6rem' }}>{z.hp}</Badge>}
                  {(z.direccion || z.comuna) && (
                    <div className="text-muted text-start" style={{ fontSize: '0.6rem', lineHeight: 1.2 }}>
                      <i className="bi bi-geo-alt text-danger"></i> {z.direccion || ''}{z.direccion && z.comuna ? ', ' : ''}{z.comuna || ''}
                    </div>
                  )}
                </th>
              ))}

              {filteredZonas.length === 0 && <th className="text-muted fst-italic fw-normal text-center bg-white">Sin zonas</th>}

              {/* SPACER COLUMN */}
              <th className="p-0 border-0 bg-transparent"></th>
            </tr>
          </thead>

          {/* CUERPO */}
          <tbody>
            {filteredActividades.map(act => (
              <React.Fragment key={act.id}>
                {/* FILA ACTIVIDAD PRINCIPAL */}
                <tr>
                  <td style={{ ...cellSticky(0), width: COL_WIDTHS.ITEM }} className="fw-semibold text-primary border-bottom">
                    {act.nombre} <Badge bg="light" text="dark" className="border ms-1" style={{ fontSize: '0.65rem' }}>{act.unidad}</Badge>
                  </td>
                  <td style={{ ...cellSticky(COL_WIDTHS.ITEM), width: COL_WIDTHS.PRECIO }} className="text-end text-muted font-monospace border-bottom">
                    ${act.valor_venta?.toLocaleString() || 0}
                  </td>
                  <td style={cellStickyTotal} className="text-center fw-bold font-monospace border-bottom">
                    {getTotalFila(act.id, 'ACT')}
                  </td>
                  {filteredZonas.map(z => {
                    const val = getCantidad(z.id, act.id, 'ACT')
                    return (
                      <td key={z.id} className="p-0 border-bottom border-start">
                        <input
                          type="number"
                          className={`form-control form-control-sm border-0 text-center bg-transparent ${val > 0 ? 'fw-bold text-primary' : 'text-muted'}`}
                          style={{ fontSize: '0.85rem' }}
                          placeholder="-"
                          defaultValue={val || ''}
                          onBlur={(e) => handleSaveCell(e.target.value, z.id, act, 'ACT')}
                        />
                      </td>
                    )
                  })}
                  {filteredZonas.length === 0 && <td className="border-bottom"></td>}

                  {/* SPACER COLUMN */}
                  <td className="border-0 p-0"></td>
                </tr>


                {/* SUB-ACTIVIDADES */}
                {act.sub_actividades?.map(sub => (
                  <tr key={`sub-${sub.id}`} className="bg-light bg-opacity-25">
                    <td style={{ ...cellSticky(0), width: COL_WIDTHS.ITEM, backgroundColor: '#fafafa' }} className="ps-4 border-bottom">
                      <i className="bi bi-arrow-return-right text-muted me-2"></i>
                      <span className="text-secondary">{sub.nombre}</span>
                      <span className="text-muted ms-1" style={{ fontSize: '0.7rem' }}>({sub.unidad})</span>
                    </td>
                    <td style={{ ...cellSticky(COL_WIDTHS.ITEM), width: COL_WIDTHS.PRECIO, backgroundColor: '#fafafa' }} className="text-end text-muted font-monospace small border-bottom">
                      ${sub.valor_venta?.toLocaleString() || 0}
                    </td>
                    <td style={{ ...cellStickyTotal, backgroundColor: '#fafafa' }} className="text-center fw-semibold font-monospace border-bottom">
                      {getTotalFila(sub.id, 'SUB')}
                    </td>
                    {filteredZonas.map(z => {
                      const val = getCantidad(z.id, sub.id, 'SUB')
                      return (
                        <td key={z.id} className="p-0 border-bottom border-start" style={{ backgroundColor: '#fafafa' }}>
                          <input
                            type="number"
                            className={`form-control form-control-sm border-0 text-center bg-transparent ${val > 0 ? 'fw-semibold' : 'text-muted'}`}
                            style={{ fontSize: '0.8rem' }}
                            placeholder="-"
                            defaultValue={val || ''}
                            onBlur={(e) => handleSaveCell(e.target.value, z.id, sub, 'SUB')}
                          />
                        </td>
                      )
                    })}
                    {filteredZonas.length === 0 && <td className="border-bottom"></td>}

                    {/* SPACER COLUMN (To prevent stretching) */}
                    <td className="border-0 p-0"></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </div>

      {/* MODAL CREAR ZONA CON AUTOCOMPLETADO DE COMUNAS */}
      <Modal show={showZonaModal} onHide={() => setShowZonaModal(false)} centered>
        <Modal.Header closeButton className="bg-light border-bottom-0">
          <Modal.Title className="h6 fw-bold">
            <i className="bi bi-geo-alt-fill text-primary me-2"></i>Nueva Zona Geográfica
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddZona}>
          <Modal.Body className="p-4">
            {/* Nombre de la zona */}
            <div className="mb-3">
              <Form.Label className="small fw-bold mb-1">Nombre de la Zona <span className="text-danger">*</span></Form.Label>
              <Form.Control
                autoFocus
                placeholder="Ej: P-102030 o Zona Norte"
                value={formZona.nombre}
                onChange={e => setFormZona({ ...formZona, nombre: e.target.value })}
                required
              />
            </div>

            {/* HP y Comuna en fila */}
            <Row className="g-3 mb-3">
              <Col xs={5}>
                <Form.Label className="small text-muted mb-1">
                  <i className="bi bi-qr-code me-1"></i>HP / ID
                </Form.Label>
                <Form.Control
                  size="sm"
                  placeholder="HP-001"
                  value={formZona.hp}
                  onChange={e => setFormZona({ ...formZona, hp: e.target.value })}
                />
              </Col>
              <Col xs={7}>
                <Form.Label className="small text-muted mb-1">
                  <i className="bi bi-building me-1"></i>Comuna
                </Form.Label>
                <Form.Control
                  size="sm"
                  list="comunas-chile-list"
                  placeholder="Escribe para buscar..."
                  value={formZona.comuna}
                  onChange={e => setFormZona({ ...formZona, comuna: e.target.value })}
                  autoComplete="off"
                />
                <datalist id="comunas-chile-list">
                  {COMUNAS_CHILE.map(c => <option key={c} value={c} />)}
                </datalist>
              </Col>
            </Row>

            {/* Dirección */}
            <div className="mb-3">
              <Form.Label className="small text-muted mb-1">
                <i className="bi bi-signpost me-1"></i>Dirección
              </Form.Label>
              <Form.Control
                size="sm"
                placeholder="Av. Principal 123"
                value={formZona.direccion}
                onChange={e => setFormZona({ ...formZona, direccion: e.target.value })}
              />
            </div>

            {/* Tramos */}
            <div className="border-top pt-3 mt-3">
              <Form.Label className="small fw-bold mb-1">
                <i className="bi bi-list-nested me-1"></i>Tramos (Opcional)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Uno por línea...&#10;Tramo A&#10;Tramo B"
                value={formZona.tramos}
                onChange={e => setFormZona({ ...formZona, tramos: e.target.value })}
                className="font-monospace small"
              />
              <Form.Text className="text-muted small">Escribe cada tramo en una línea separada.</Form.Text>
            </div>
          </Modal.Body>
          <Modal.Footer className="py-2 bg-light border-top-0">
            <Button size="sm" variant="outline-secondary" onClick={() => setShowZonaModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" type="submit">
              <i className="bi bi-check-lg me-1"></i>Guardar Zona
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
  )
}

export default Cubicacion