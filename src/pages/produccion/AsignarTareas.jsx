import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Modal, Button, Form, Row, Col, Card, Badge, Spinner } from 'react-bootstrap'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { PDFDownloadLink } from '@react-pdf/renderer' // <--- IMPORTANTE
import DocumentoEP from '../../components/pdf/DocumentoEP' // <--- EL ARCHIVO NUEVO
import TimelineView from '../../components/TimelineView';

// Servicios
import { tareasService } from '../../services/tareasService'
import { cuadrillasService } from '../../services/cuadrillasService'
import { actividadesService } from '../../services/actividadesService'
import { zonasService } from '../../services/zonasService'
import { storageService } from '../../services/storageService'
import { estadosPagoService } from '../../services/estadosPagoService'
import { proyectosService } from '../../services/proyectosService'
import { stockService } from '../../services/stockService'
import { generarExcelPlanificacion } from '../../services/excelExportService'
import EstadoPagoCard from '../../components/EstadoPagoCard'
import ModalGestionEP from '../../components/ModalGestionEP'

function AsignarTareas() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // Datos
  const [tareas, setTareas] = useState([])
  const [cuadrillasOpts, setCuadrillasOpts] = useState([])
  const [actividadesData, setActividadesData] = useState([])
  const [zonasOpts, setZonasOpts] = useState([])
  const [proyectoInfo, setProyectoInfo] = useState(null)
  const [epsRawData, setEpsRawData] = useState([]) 
    const [epsEmitidos, setEpsEmitidos] = useState([])
    const [showGestionModal, setShowGestionModal] = useState(false)
    const [epToManage, setEpToManage] = useState(null)
        const [proveedoresFull, setProveedoresFull] = useState([]) // <--- Nuevo almacén de datos
    // Controla qué vista estamos viendo: 'kanban' o 'timeline'
    const [viewMode, setViewMode] = useState('kanban');

  // Filtros
  const [filterProv, setFilterProv] = useState(null)
  const [filterZona, setFilterZona] = useState(null)
  const [filterDateRange, setFilterDateRange] = useState([null, null])

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Form State
  const [inputType, setInputType] = useState('ACT')
  const [selectedCuadrilla, setSelectedCuadrilla] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedZona, setSelectedZona] = useState(null)
  const [selectedTramo, setSelectedTramo] = useState(null)
  const [tramosOpts, setTramosOpts] = useState([])
  
  const [dateRange, setDateRange] = useState([null, null])
  const [startDate, endDate] = dateRange

  // CANTIDADES (SEPARADAS)
  const [cantidadAsignada, setCantidadAsignada] = useState('') // Plan
  const [cantidadReal, setCantidadReal] = useState('')         // Ejecutado

    // --- NUEVOS ESTADOS DE EJECUCIÓN ---
    const [puntaInicio, setPuntaInicio] = useState('')
    const [puntaFinal, setPuntaFinal] = useState('')

    // Estados para Geolocalización
    const [showGeoModal, setShowGeoModal] = useState(false)
    const [geoData, setGeoData] = useState({
            coords: '',
            lat: '',
            lon: '',
            foto: null,
            fotoUrl: null
    })

  const [archivo, setArchivo] = useState(null)
  const [archivoUrlExistente, setArchivoUrlExistente] = useState(null)
  const [comentarios, setComentarios] = useState('')
  const [selectedEP, setSelectedEP] = useState(null)

    // Materiales / Stock
    const [materialesDisponibles, setMaterialesDisponibles] = useState([])
    const [consumosTarea, setConsumosTarea] = useState([])
    const [selMaterial, setSelMaterial] = useState(null)
    const [cantMaterial, setCantMaterial] = useState('')

  // Finanzas
  const [finanzas, setFinanzas] = useState({ costoUnit: 0, ventaUnit: 0, totalCosto: 0, totalVenta: 0, valid: false })
  const [tarifaCheck, setTarifaCheck] = useState({ checking: false, valido: false, msg: '' })

  useEffect(() => { loadInitialData() }, [projectId])

    const loadInitialData = async () => {
        try {
                // 🔥 CAMBIO: Usamos getAll en lugar de getBorradores para tener TODO en la variable principal
                const [t, c, a, z, p, todosLosEPs] = await Promise.all([
                        tareasService.getTareas(projectId),
                        cuadrillasService.getCuadrillasProyecto(projectId),
                        actividadesService.getActividades(projectId),
                        zonasService.getZonas(projectId),
                        proyectosService.getById(projectId),
                        estadosPagoService.getAll(projectId)
                ])

                setTareas(t)
                setCuadrillasOpts(c.map(x => ({ value: x.proveedor.id, label: x.proveedor.nombre })))
                // Guardamos lista completa de proveedores (contiene email, telefono, rut, etc.)
                const listaProvs = c.map(x => x.proveedor).filter(Boolean)
                setProveedoresFull(listaProvs)
                setZonasOpts(z.map(x => ({ value: x.id, label: x.nombre })))
                setActividadesData(a)
                setProyectoInfo(p)
                setEpsRawData(todosLosEPs) // <--- Ahora contiene Borradores Y Emitidos
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

  // --- LOGICA ---
  const filteredTasks = useMemo(() => {
    return tareas.filter(t => {
        if(filterProv && t.proveedor_id !== filterProv.value) return false
        if(filterZona && t.zona_id !== filterZona.value) return false
        if(filterDateRange[0] && filterDateRange[1]) {
            if(!t.fecha_asignacion) return false
            const tStart = parseISO(t.fecha_asignacion)
            if (tStart < filterDateRange[0] || tStart > filterDateRange[1]) return false
        }
        return true
    }).sort((a, b) => a.position - b.position)
  }, [tareas, filterProv, filterZona, filterDateRange])

  const getItemOptions = () => {
    if(inputType === 'ACT') {
        return actividadesData.map(a => ({ value: a.id, label: `${a.nombre} (${a.unidad})`, precioVenta: a.valor_venta, type: 'ACT' }))
    } else {
        let subs = []
        actividadesData.forEach(a => {
            if(a.sub_actividades) {
                a.sub_actividades.forEach(s => {
                    subs.push({ value: s.id, label: `${s.nombre} (${s.unidad})`, precioVenta: s.valor_venta, type: 'SUB' })
                })
            }
        })
        return subs
    }
  }

  const getCompatibleEPs = () => {
      if (!editingTask) return []
      const proveedorTarea = editingTask.proveedor_id
      return epsRawData
        .filter(ep => ep.proveedor_id === null || ep.proveedor_id === proveedorTarea)
        .map(ep => ({ value: ep.id, label: `${ep.codigo} - ${ep.nombre} ${ep.proveedor_id ? '(Asignado)' : '(Nuevo)'}` }))
  }

  const handleZonaChange = async (option) => {
    setSelectedZona(option)
    setSelectedTramo(null)
    if(option) {
        const t = await zonasService.getTramos(option.value)
        setTramosOpts(t.map(x => ({ value: x.id, label: x.nombre })))
    } else { setTramosOpts([]) }
  }

  // CEREBRO DE PRECIOS (Ajustado para usar Cantidad REAL si existe, o Asignada si no)
  useEffect(() => {
    setFinanzas({ costoUnit: 0, ventaUnit: 0, totalCosto: 0, totalVenta: 0, valid: false })
    if(!selectedCuadrilla || !selectedItem) { setTarifaCheck({ checking: false, valido: false, msg: '' }); return }
    setTarifaCheck(prev => ({ ...prev, checking: true, msg: 'Consultando...' }))
    
    const calcular = async () => {
        try {
            const tarifas = await actividadesService.getTarifas(projectId, selectedItem.value, selectedItem.type)
            const tarifaPactada = tarifas.find(t => t.proveedor.id === selectedCuadrilla.value)
            
            if(tarifaPactada) {
                const costoU = Number(tarifaPactada.valor_costo)
                const ventaU = Number(selectedItem.precioVenta) || 0
                
                // Si estamos editando una REALIZADA, el cálculo monetario se basa en lo REAL
                // Si estamos en ASIGNADA, se basa en lo PLANIFICADO
                const isRealPhase = isEditing && editingTask?.estado !== 'ASIGNADA'
                const qtyToCalc = isRealPhase ? (Number(cantidadReal) || 0) : (Number(cantidadAsignada) || 0)

                setFinanzas({ 
                    costoUnit: costoU, 
                    ventaUnit: ventaU, 
                    totalCosto: costoU * qtyToCalc, 
                    totalVenta: ventaU * qtyToCalc, 
                    valid: true 
                })
                setTarifaCheck({ checking: false, valido: true, msg: 'Tarifa OK' })
            } else {
                setFinanzas(prev => ({...prev, valid: false}))
                setTarifaCheck({ checking: false, valido: false, msg: 'Sin contrato' })
            }
        } catch(err) { console.error(err) }
    }
    const timer = setTimeout(calcular, 300)
    return () => clearTimeout(timer)
  }, [selectedCuadrilla, selectedItem, cantidadAsignada, cantidadReal, isEditing]) 


  // --- ACTIONS EP ---
  const handleCreateNextEP = async () => {
      if(!editingTask) return
      if(!window.confirm(`¿Generar nuevo EP exclusivo para ${editingTask.proveedor?.nombre}?`)) return
      try {
          // 1. Obtenemos el nombre o código del proyecto
          // Si proyectoInfo.codigo existe, úsalo. Si no, usa el nombre.
          let rawName = proyectoInfo?.codigo || proyectoInfo?.nombre || 'PROYECTO'
          
          // 2. LIMPIEZA: Quitamos espacios, guiones raros y pasamos a mayúsculas
          // Ejemplo: "Casa de Verano" -> "CASADEVERANO"
          const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
          
          // 3. Creamos el prefijo base: "EP-CASADEVERANO"
          const codigoBase = `EP-${cleanName}`

          // 4. Llamamos al backend (que le agregará el -001, -002...)
          const newEp = await estadosPagoService.crearSiguiente(
              Number(projectId), // Aseguramos que sea número
              codigoBase,
              editingTask.proveedor_id
          );
          const updatedEps = await estadosPagoService.getBorradores(projectId)
          setEpsRawData(updatedEps)
          setSelectedEP({ value: newEp.id, label: `${newEp.codigo} - ${newEp.nombre} (Asignado)` })
      } catch(err) { alert('Error creando EP'); console.error(err) }
  }

  // Abrir modal de gestión de EP (inyección forzada de datos del proveedor)
  const handleOpenGestion = (ep) => {
      // 1. Buscamos al proveedor en nuestra lista completa
      const datosExtra = proveedoresFull.find(p => p.id === ep.proveedor_id);

      console.log("Inyectando datos al EP:", datosExtra);

      // 2. Creamos un objeto EP enriquecido
      const epConDatos = {
          ...ep,
          proveedor: {
              ...ep.proveedor,
              // Inyectamos los campos faltantes, con valores por defecto si no existen
              email: datosExtra?.email || datosExtra?.correo || datosExtra?.contacto_email || 'sin_correo@registrado.cl',
              phone: datosExtra?.phone || datosExtra?.telefono || datosExtra?.fono || 'S/Información',
              rut: datosExtra?.rut || ep.proveedor?.rut || ''
          }
      };

      setEpToManage(epConDatos);
      setShowGestionModal(true);
  }

  // Procesar emisión: valida y llama al RPC que hace el trabajo en el servidor
  const procesarEmision = async (payload) => {
      // payload trae: { epId, taskIds, discountIds, tasksTotal, montoFinal }
      
      // Validación de seguridad
      if (!payload.taskIds || payload.taskIds.length === 0) {
          alert("Error: No se han seleccionado tareas para emitir.");
          return;
      }

      setLoading(true);
      try {
          // 1. Llamamos al servicio (que llama al SQL)
          const { error } = await estadosPagoService.procesarEmision(payload);
          
          if(error) throw error;

          // 2. Éxito visual
          alert("Estado de Pago Emitido Correctamente");
          setShowGestionModal(false);
          setEpToManage(null);

          // 3. Recarga CRÍTICA:
          // Esto hará que las tareas pasen a estado 'PAGADA' (desaparezcan de la col 3)
          // Y el EP pase a 'EMITIDO' con los datos correctos (aparezca en la col 4)
          await loadInitialData(); 

      } catch (err) {
          console.error("Error emitiendo:", err);
          alert("Hubo un error al procesar la emisión. Revisa la consola.");
      } finally {
          setLoading(false);
      }
  }

    // Refrescar solo los EPs (más ligero que recargar todo)
    const refreshEPs = async () => {
        try {
            const eps = await estadosPagoService.getAll(projectId)
            setEpsRawData(eps)
        } catch (err) { console.error('Error refrescando EPs', err) }
    }

  const handleEditEPCode = async () => {
      if(!selectedEP) return
      const nuevoCodigo = prompt("Editar Código del Estado de Pago:", selectedEP.label.split(' - ')[0])
      if(nuevoCodigo && nuevoCodigo.trim() !== "") {
          try {
              await estadosPagoService.actualizarCodigo(selectedEP.value, nuevoCodigo.trim())
              const updatedEps = await estadosPagoService.getBorradores(projectId)
              setEpsRawData(updatedEps)
              const epUpdated = updatedEps.find(e => e.id === selectedEP.value)
              if(epUpdated) setSelectedEP({ value: epUpdated.id, label: `${epUpdated.codigo} - ${epUpdated.nombre} ${epUpdated.proveedor_id?'(Asignado)':''}` })
          } catch(err) { alert("Error editando código") }
      }
  }

  // --- SAVE ---
  const handleSave = async (e) => {
    e.preventDefault()
    if(!finanzas.valid) return alert("Tarifa no válida.")

    setUploading(true)
    try {
        let fileUrl = archivoUrlExistente
        if(archivo) fileUrl = await storageService.subirArchivo(archivo)

        // 2. NUEVO: Subir Foto Geolocalización (Si se seleccionó una nueva)
        let geoFotoFinalUrl = geoData.fotoUrl;
        if (geoData.foto) {
            try {
                geoFotoFinalUrl = await storageService.subirArchivo(geoData.foto);
            } catch (errGeo) {
                console.error('Error subiendo foto geo', errGeo);
                // no bloquear, dejamos la URL existente o null
            }
        }

        if (selectedEP) {
            await estadosPagoService.asignarDueño(selectedEP.value, selectedCuadrilla?.value || editingTask?.proveedor_id)
        }

        // 1. Calculamos el Estado de Pago correcto
        let estadoPagoFinal = null;

        if (showPaymentSection) {
            // Si estamos en APROBADA (vemos el selector), usamos lo que el usuario eligió
            estadoPagoFinal = selectedEP?.value || null;
        } else {
            // Si estamos en EJECUCIÓN o ASIGNADA (selector oculto),
            // mantenemos el que ya tenía la tarea para no borrarlo accidentalmente.
            estadoPagoFinal = editingTask?.estado_pago_id || null;
        }

        const payload = {
            proyecto_id: Number(projectId),
            proveedor_id: selectedCuadrilla?.value || editingTask?.proveedor_id,
            zona_id: selectedZona.value,
            tramo_id: selectedTramo?.value,
            
            cantidad_asignada: Number(cantidadAsignada),
            
            precio_costo_unitario: finanzas.costoUnit,
            precio_venta_unitario: finanzas.ventaUnit,
            fecha_asignacion: startDate,
            fecha_estimada_termino: endDate,
            archivo_plano_url: fileUrl,
            comentarios_asignacion: comentarios,

            // --- NUEVOS CAMPOS ---
            punta_inicio: puntaInicio || null,
            punta_final: puntaFinal || null,
            geo_coords: geoData.coords || null,
            geo_lat: geoData.lat || null,
            geo_lon: geoData.lon || null,
            geo_foto_url: geoFotoFinalUrl || null,
            // ---------------------

            // AQUÍ USAMOS LA VARIABLE CALCULADA ARRIBA
            estado_pago_id: estadoPagoFinal 
        }

        // SI NO ES 'ASIGNADA', AGREGAMOS LA CANTIDAD REAL
        if (isEditing && editingTask?.estado !== 'ASIGNADA') {
            payload.cantidad_real = Number(cantidadReal)
            // Si hay cantidad real y no hay fecha de termino, poner hoy por defecto, sino mantener la que estaba o poner null
            if(Number(cantidadReal) > 0 && !editingTask.fecha_termino_real) {
                payload.fecha_termino_real = new Date()
            }
        }

        if(inputType === 'ACT') { payload.actividad_id = selectedItem.value; payload.sub_actividad_id = null }
        else { payload.sub_actividad_id = selectedItem.value; payload.actividad_id = null }

        if(isEditing) {
            await tareasService.actualizarEstado(editingTask.id, editingTask.estado, payload)
        } else {
            payload.estado = 'ASIGNADA'
            await tareasService.crearTarea(payload)
        }

        setShowModal(false)
        loadInitialData()
    } catch(err) { alert('Error guardando'); console.error(err) }
    finally { setUploading(false) }
  }

  // --- DRAG (LÓGICA CORREGIDA) ---
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const movedId = Number(draggableId)
    const newStatus = destination.droppableId
    const oldStatus = source.droppableId
    const destColumnTasks = filteredTasks.filter(t => t.estado === newStatus)
    const neighbors = destColumnTasks.filter(t => t.id !== movedId)
    
    let newPosition;
    if (neighbors.length === 0) newPosition = Date.now(); 
    else if (destination.index === 0) newPosition = (neighbors[0].position || Date.now()) - 100000;
    else if (destination.index >= neighbors.length) newPosition = (neighbors[neighbors.length - 1].position || 0) + 100000;
    else {
        const prevCard = neighbors[destination.index - 1];
        const nextCard = neighbors[destination.index];     
        newPosition = ((prevCard.position || 0) + (nextCard.position || 0)) / 2;
    }

    // Actualización optimista local (UI)
    const updatedTareas = tareas.map(t => {
        if(t.id === movedId) {
            // 1. Creamos la copia con la nueva posición y estado
            const updatedTask = { ...t, estado: newStatus, position: newPosition }
            
            // 2. CORRECCIÓN: Si vuelve a 'ASIGNADA', limpiamos TODO
            if(newStatus === 'ASIGNADA' && oldStatus !== 'ASIGNADA') {
                // Limpiamos los valores numéricos/IDs
                updatedTask.cantidad_real = null
                updatedTask.fecha_termino_real = null
                updatedTask.estado_pago_id = null

                // 🔥 Borramos el OBJETO visual para que desaparezca la etiqueta "EP:..." de la tarjeta
                updatedTask.estado_pago = null
                // --- BORRADO VISUAL DE NUEVOS CAMPOS ---
                updatedTask.punta_inicio = null;
                updatedTask.punta_final = null;
                updatedTask.geo_coords = null;
                updatedTask.geo_lat = null;
                updatedTask.geo_lon = null;
                updatedTask.geo_foto_url = null;
            }
            
            // 3. (Opcional) Si pasa a REALIZADA, inicializamos en 0 visualmente
            if(newStatus === 'REALIZADA' && oldStatus === 'ASIGNADA') {
                 updatedTask.cantidad_real = 0
            }

            return updatedTask
        }
        return t
    })
    
    setTareas(updatedTareas.sort((a, b) => (a.position || 0) - (b.position || 0)));

    try {
        let extraData = { position: newPosition }
        
        // REGLA: AVANZAR A REALIZADA -> CANTIDAD REAL EN 0 (Para obligar ingreso manual)
        if(newStatus === 'REALIZADA' && oldStatus === 'ASIGNADA') {
            extraData.cantidad_real = 0 
            extraData.fecha_termino_real = new Date()
        }
        
        // REGLA: RETROCEDER A ASIGNADA -> SOLO LIMPIAMOS VALORES DE LA TABLA TAREAS
        if(newStatus === 'ASIGNADA' && oldStatus !== 'ASIGNADA') {
            extraData.cantidad_real = null
            extraData.fecha_termino_real = null
            extraData.estado_pago_id = null 

            // --- LIMPIEZA EN BD ---
            extraData.punta_inicio = null;
            extraData.punta_final = null;
            extraData.geo_coords = null;
            extraData.geo_lat = null;
            extraData.geo_lon = null;
            extraData.geo_foto_url = null;

            // ❌ La limpieza de consumos/materiales la realiza ahora el trigger en la DB
        }

        // 🔥 NUEVA LÓGICA: ASIGNACIÓN AUTOMÁTICA AL ENTRAR A APROBADA
        if (newStatus === 'APROBADA' && oldStatus !== 'APROBADA') {
            // 1. Buscamos la tarea completa para saber quién es el proveedor
            const tareaActual = tareas.find(t => t.id === movedId);
            if (tareaActual) {
                try {
                    // 2. Obtenemos el nombre limpio del proyecto para el código
                    let rawName = proyectoInfo?.codigo || proyectoInfo?.nombre || 'PROY';
                    const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const codigoBase = `EP-${cleanName}`;

                    // 3. LLAMADA MÁGICA: El backend busca huecos, crea o asigna
                    const epAsignado = await estadosPagoService.asignarBorradorAutomatico(
                        Number(projectId),
                        codigoBase,
                        tareaActual.proveedor_id
                    );

                    // 4. Asignamos el ID del EP retornado a la tarea
                    if (epAsignado && epAsignado.id) {
                        extraData.estado_pago_id = epAsignado.id;
                        // 5. (Opcional) Forzamos recarga rápida para que aparezca la etiqueta negra "EP-..."
                        setTimeout(() => loadInitialData(), 500);
                    }
                } catch (errEp) {
                    console.error('Error asignando EP automático:', errEp);
                }
            }
        }

        await tareasService.actualizarEstado(movedId, newStatus, extraData)

            // 🔥 Recargamos los EPs para ver si alguno se creó o se borró
            try { await refreshEPs() } catch (e) { /* no bloquear */ }
    } catch(err) { console.error("Error movimiento", err); loadInitialData() }
  }
  
  const handleQuickConfirm = async (e, task) => {
    e.stopPropagation()
    if(!window.confirm(`¿Confirmar realizado 100% (${task.cantidad_asignada})?`)) return
    try {
        await tareasService.actualizarEstado(task.id, 'REALIZADA', { cantidad_real: task.cantidad_asignada, fecha_termino_real: new Date() })
        loadInitialData()
    } catch(err) { alert('Error') }
  }

    const handleDelete = async () => {
        if(!editingTask) return
        if(!window.confirm("¿Eliminar tarea?")) return
        try {
                await tareasService.eliminarTarea(editingTask.id);
                setShowModal(false);

                // Opción más rápida: Recargar tareas y EPs en paralelo
                const t = await tareasService.getTareas(projectId);
                setTareas(t);
                await refreshEPs(); // 🔥 Actualiza la columna de EPs
        } catch(err) { alert('Error') }
    }

  // --- MODALS OPEN ---
  const openCreateModal = () => {
    setIsEditing(false); setEditingTask(null); setSelectedCuadrilla(null); setSelectedItem(null);
    setSelectedZona(null); setSelectedTramo(null); 
    setCantidadAsignada(''); setCantidadReal(''); // Reset ambos
        setPuntaInicio(''); setPuntaFinal('');
        setGeoData({ coords: '', lat: '', lon: '', foto: null, fotoUrl: null });
        setShowGeoModal(false);
    setDateRange([null, null]);
    setComentarios(''); setArchivo(null); setArchivoUrlExistente(null); setSelectedEP(null);
        // Reset materiales visuales al crear nueva tarea
        setConsumosTarea([])
        setMaterialesDisponibles([])
        setShowModal(true)
  }

  const openEditModal = async (task) => {
    setIsEditing(true)
    setEditingTask(task)
    setSelectedCuadrilla(cuadrillasOpts.find(c => c.value === task.proveedor_id))
    if(task.actividad_id) {
        setInputType('ACT')
        const act = actividadesData.find(a => a.id === task.actividad_id)
        if(act) setSelectedItem({ value: act.id, label: `${act.nombre} (${act.unidad})`, precioVenta: act.valor_venta, type: 'ACT' })
    } else {
        setInputType('SUB')
        setSelectedItem({ value: task.sub_actividad_id, label: task.sub_actividad?.nombre, type: 'SUB', precioVenta: 0 }) 
    }
    const zOpt = zonasOpts.find(z => z.value === task.zona_id)
    setSelectedZona(zOpt)
    if(task.zona_id) {
        const t = await zonasService.getTramos(task.zona_id)
        const tOpts = t.map(x => ({ value: x.id, label: x.nombre }))
        setTramosOpts(tOpts)
        setSelectedTramo(tOpts.find(tr => tr.value === task.tramo_id))
    }
    
    // CARGAR CANTIDADES
    setCantidadAsignada(task.cantidad_asignada)
    setCantidadReal(task.cantidad_real || 0)

    setDateRange([task.fecha_asignacion ? parseISO(task.fecha_asignacion) : null, task.fecha_estimada_termino ? parseISO(task.fecha_estimada_termino) : null])
    setComentarios(task.comentarios_asignacion || '')
    setArchivoUrlExistente(task.archivo_plano_url)
    
    if(task.estado_pago_id && task.estado_pago) {
        const ep = task.estado_pago
        setSelectedEP({ value: ep.id, label: `${ep.codigo} - ${ep.estado}` })
    } else {
        setSelectedEP(null)
    }
    // CARGAR PUNTAS
    setPuntaInicio(task.punta_inicio || '');
    setPuntaFinal(task.punta_final || '');

    // CARGAR GEO
    setGeoData({
        coords: task.geo_coords || '',
        lat: task.geo_lat || '',
        lon: task.geo_lon || '',
        foto: null,
        fotoUrl: task.geo_foto_url || null
    });
    setShowGeoModal(false);
    // Si la tarea está en ejecución o terminada, cargamos materiales
    if (task.estado !== 'ASIGNADA') {
        loadMateriales(task.proveedor_id, task.id)
    }
        setShowModal(true)
  }

    // Cerrar modal y resetear campos relacionados (incluye materiales)
    const handleCloseModal = () => {
            setShowModal(false)
            setEditingTask(null)
            setConsumosTarea([])
            setMaterialesDisponibles([])
            setDateRange([null, null])
            setSelectedEP(null)
    }

  const loadMateriales = async (provId, taskId) => {
      try {
          // El projectId ya lo tienes disponible arriba gracias a useParams()
          const [disponibles, consumidos] = await Promise.all([
              // 👇 AQUÍ ESTÁ EL CAMBIO IMPORTANTE: Agregamos projectId
              stockService.getMaterialesDisponibles(provId, projectId), 
              stockService.getConsumosTarea(taskId)
          ])
          setMaterialesDisponibles(disponibles.map(m => ({
              value: m.codigo,
              label: `${m.nombre} (Disp: ${m.saldo} ${m.unidad})`,
              max: m.saldo,
              data: m
          })))
          setConsumosTarea(consumidos || [])
      } catch (err) { console.error(err) }
  }

  const handleAddMaterial = async () => {
      if(!selMaterial || !cantMaterial) return
      if(Number(cantMaterial) > selMaterial.max) return alert("No tienes suficiente saldo de este material")

      try {
          await stockService.registrarConsumo({
              tarea_id: editingTask.id,
              producto_codigo: selMaterial.value,
              nombre_producto: selMaterial.data.nombre,
              unidad: selMaterial.data.unidad,
              cantidad: Number(cantMaterial),
              // TRAZABILIDAD: Guardamos dónde se usó
              zona_nombre: editingTask.zona?.nombre || 'S/I',
              tramo_nombre: editingTask.tramo?.nombre || 'S/I'
          })
          setSelMaterial(null)
          setCantMaterial('')
          loadMateriales(editingTask.proveedor_id, editingTask.id) // Recargar para actualizar saldos
      } catch(err) { alert("Error guardando material") }
  }

  const handleDeleteMaterial = async (id) => {
      if(!window.confirm("Borrar consumo?")) return
      await stockService.eliminarConsumo(id)
      loadMateriales(editingTask.proveedor_id, editingTask.id)
  }

  // --- HELPERS VISUALES ---
    const canEditCore = !isEditing || (editingTask?.estado === 'ASIGNADA')
    // AHORA: ocultamos siempre el selector/manual de asignación a EP
    const showPaymentSection = false
  const isExecutionPhase = isEditing && editingTask?.estado !== 'ASIGNADA'
    const canManageMaterials = editingTask?.estado === 'REALIZADA'

  return (
    <div className="container-fluid d-flex flex-column bg-white" style={{height: 'calc(100vh - 64px)'}}>
      {/* HEADER */}
      <div className="bg-white border-bottom shadow-sm px-4 py-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-3">
                <Button variant="outline-dark" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)} className="rounded-circle border-0 bg-light"><i className="bi bi-arrow-left"></i></Button>
                <div><h5 className="fw-bold text-dark mb-0">Planificación Kanban</h5><small className="text-muted">Gestión visual.</small></div>
            </div>
            {/* BOTONES DE ACCIÓN (Header) */}
            <div className="d-flex gap-2 align-items-center">
                {/* --- SELECTOR DE VISTA (NUEVO) --- */}
                <div className="btn-group shadow-sm me-2" role="group">
                    <button 
                        type="button" 
                        className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => setViewMode('kanban')}
                    >
                        <i className="bi bi-kanban me-2"></i>Tablero
                    </button>
                    <button 
                        type="button" 
                        className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                        onClick={() => setViewMode('timeline')}
                    >
                        <i className="bi bi-calendar-range me-2"></i>Cronograma
                    </button>
                </div>
                {/* -------------------------------- */}

                <Button
                    variant="outline-success"
                    size="sm"
                    onClick={() => generarExcelPlanificacion(tareas, epsRawData, proyectoInfo)}
                    className="shadow-sm rounded-pill d-flex align-items-center gap-2 px-3"
                    title="Exportar datos en CSV"
                >
                    <i className="bi bi-download"></i>
                    <span className="fw-semibold">Exportar CSV</span>
                </Button>

                <Button variant="primary" size="sm" onClick={openCreateModal} className="shadow-sm px-3"><i className="bi bi-plus-lg me-2"></i>Nueva Tarea</Button>
            </div>
        </div>
        <Row className="g-2">
            <Col md={3}><Select options={cuadrillasOpts} placeholder="Filtrar Subcontrato..." isClearable onChange={setFilterProv} styles={{ control: (base) => ({ ...base, minHeight: '32px', height: '32px', fontSize: '0.85rem' }) }}/></Col>
            <Col md={3}><Select options={zonasOpts} placeholder="Filtrar Zona..." isClearable onChange={setFilterZona} styles={{ control: (base) => ({ ...base, minHeight: '32px', height: '32px', fontSize: '0.85rem' }) }}/></Col>
            <Col md={3}><DatePicker selectsRange startDate={filterDateRange[0]} endDate={filterDateRange[1]} onChange={(update) => setFilterDateRange(update)} placeholderText="Filtrar Fechas" className="form-control form-control-sm" dateFormat="dd/MM/yyyy" isClearable /></Col>
        </Row>
      </div>

      {/* BOARD */}
            {loading ? (
                <div className="p-5 text-center"><Spinner animation="border"/></div>
            ) : (
                // AQUÍ EMPIEZA LA MAGIA DEL SWITCH
                <div className="flex-grow-1 p-3 w-100 overflow-hidden d-flex flex-column">
                    {viewMode === 'kanban' ? (
                        /* VISTA 1: KANBAN (Tu código existente) */
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <div className="d-flex gap-3 h-100 overflow-x-auto pb-2">
                                <KanbanColumn id="ASIGNADA" title="Por Hacer / Asignadas" color="#64748b" tasks={filteredTasks.filter(t => t.estado === 'ASIGNADA')} onDblClick={openEditModal} onQuickConfirm={handleQuickConfirm} />
                                <KanbanColumn id="REALIZADA" title="En Ejecución / Realizadas" color="#3b82f6" tasks={filteredTasks.filter(t => t.estado === 'REALIZADA')} onDblClick={openEditModal} onQuickConfirm={handleQuickConfirm} />
                                <KanbanColumn 
                                    id="APROBADA" 
                                    title="Aprobadas (Listas para Pago)" 
                                    color="#10b981" 
                                    tasks={filteredTasks.filter(t => t.estado === 'APROBADA')} 
                                    onDblClick={openEditModal} 
                                    onEmitirFromTask={(task) => {
                                        const epPadre = epsRawData.find(e => e.id === task.estado_pago_id);
                                        if(epPadre) {
                                            handleOpenGestion(epPadre);
                                        } else {
                                            alert("Error: No se encuentra el borrador asociado.");
                                        }
                                    }}
                                />

                                {/* 4. COLUMNA GESTIÓN FINANCIERA (Solo Emitidos y Pagados) */}
                                <div className="d-flex flex-column h-100 rounded-3 shadow-sm" 
                                     style={{
                                         flex: '1 1 0px', 
                                         minWidth: '250px', 
                                         backgroundColor: '#e0e7ff', 
                                         padding: '8px'
                                     }}>
                                    <div className="d-flex align-items-center justify-content-between mb-2 px-1">
                                        <span className="fw-bold text-dark small text-uppercase">
                                            <i className="bi bi-files me-2"></i>Emitidos / Pagados
                                        </span>
                                        {/* CONTADOR: Solo contamos lo que realmente está cerrado */}
                                        <span className="badge bg-primary rounded-pill text-white">
                                            {epsRawData.filter(e => ['EMITIDO', 'PAGADO'].includes(e.estado)).length}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-grow-1" style={{overflowY: 'auto', minHeight: '100px'}}>
                                        {epsRawData
                                            // 🔥 CORRECCIÓN: Filtro estricto. Si es BORRADOR, NO se muestra aquí.
                                            .filter(ep => ['EMITIDO', 'PAGADO'].includes(ep.estado))
                                            // Ordenamos por ID descendente (los más nuevos arriba)
                                            .sort((a, b) => b.id - a.id)
                                            .map(ep => (
                                                <EstadoPagoCard 
                                                    key={ep.id} 
                                                    ep={ep} 
                                                    onEmitirClick={handleOpenGestion} 
                                                />
                                            ))
                                        }
                                        
                                        {/* Mensaje si no hay EMITIDOS (aunque haya borradores ocultos) */}
                                        {epsRawData.filter(e => ['EMITIDO', 'PAGADO'].includes(e.estado)).length === 0 && (
                                            <div className="text-center text-muted mt-5 small fst-italic">
                                                No hay estados de pago emitidos aún.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </DragDropContext>
                    ) : (
                        /* VISTA 2: CRONOGRAMA (Lo nuevo) */
                        <div className="h-100 overflow-auto">
                            <TimelineView 
                                tareas={filteredTasks}
                                proveedores={proveedoresFull}
                                onEditTask={(tarea) => openEditModal(tarea)}
                                onResizeTask={async (tareaId, cambios) => {
                                    try {
                                        await tareasService.actualizarTarea(tareaId, cambios);
                                        // Recargar tareas después de actualizar
                                        loadInitialData();
                                    } catch (error) {
                                        console.error('Error al actualizar fechas:', error);
                                        alert('Error al actualizar las fechas de la tarea');
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

      {/* Modal de Gestión de EP */}
      <ModalGestionEP 
          show={showGestionModal}
          onHide={() => setShowGestionModal(false)}
          ep={epToManage}
          onEmitir={procesarEmision}
          proyectoInfo={proyectoInfo}
      />

      {/* MODAL */}
    <Modal show={showModal} onHide={handleCloseModal} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="border-0 bg-light">
            <Modal.Title className="fw-bold text-dark h5">
                {isEditing ? `Editar Tarea` : 'Crear Orden de Trabajo'} {editingTask?.estado && <Badge bg="secondary" className="ms-2">{editingTask.estado}</Badge>}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 pb-4">
            <Form onSubmit={handleSave}>
                
                {/* 1. SECCIÓN PAGO BLINDADA */}
                {showPaymentSection && (
                    <div className="bg-success bg-opacity-10 border border-success p-3 rounded mb-4">
                        <h6 className="fw-bold text-success mb-3"><i className="bi bi-cash-stack me-2"></i>Asignación a Estado de Pago</h6>
                        <div className="alert alert-light border small py-2 mb-3 d-flex align-items-center text-muted"><i className="bi bi-info-circle-fill me-2 text-info"></i><div>Mostrando EPs de: <strong>{editingTask?.proveedor?.nombre}</strong></div></div>
                        <Row className="g-2 align-items-end">
                            <Col md={7}><Form.Label className="small fw-bold text-muted">Seleccionar EP Abierto</Form.Label><div className="d-flex gap-2"><div className="flex-grow-1"><Select options={getCompatibleEPs()} placeholder="Seleccione un borrador..." value={selectedEP} onChange={setSelectedEP} noOptionsMessage={() => "Ningún EP disponible."} isClearable /></div>{selectedEP && (<Button variant="outline-secondary" onClick={handleEditEPCode} title="Editar Código"><i className="bi bi-pencil"></i></Button>)}</div></Col>
                            <Col md={5}><Button variant="success" className="w-100 text-white shadow-sm" onClick={handleCreateNextEP}><i className="bi bi-magic me-1"></i> Generar Nuevo</Button></Col>
                        </Row>
                    </div>
                )}

                {/* 2. SELECTOR TIPO */}
                {!isEditing && (
                    <div className="d-flex justify-content-center mb-4 bg-light p-1 rounded-pill border mx-auto" style={{width: 'fit-content'}}>
                        <Button variant={inputType === 'ACT' ? 'white' : 'transparent'} className={`rounded-pill px-4 border-0 fw-bold ${inputType === 'ACT' ? 'shadow-sm text-primary' : 'text-muted'}`} onClick={() => { setInputType('ACT'); setSelectedItem(null); }}>Actividad</Button>
                        <Button variant={inputType === 'SUB' ? 'white' : 'transparent'} className={`rounded-pill px-4 border-0 fw-bold ${inputType === 'SUB' ? 'shadow-sm text-primary' : 'text-muted'}`} onClick={() => { setInputType('SUB'); setSelectedItem(null); }}>Sub-Actividad</Button>
                    </div>
                )}
                
                <Row className="g-3">
                    <Col md={6}><Form.Label className="small fw-bold text-muted">Contratista</Form.Label><Select options={cuadrillasOpts} placeholder="Buscar..." value={selectedCuadrilla} onChange={setSelectedCuadrilla} isDisabled={!canEditCore} /></Col>
                    <Col md={6}><Form.Label className="small fw-bold text-muted">Item</Form.Label><Select options={getItemOptions()} placeholder="Buscar..." value={selectedItem} onChange={setSelectedItem} isDisabled={!canEditCore} /></Col>
                    <Col md={6}><Form.Label className="small fw-bold text-muted">Zona</Form.Label><Select options={zonasOpts} placeholder="Zona..." value={selectedZona} onChange={handleZonaChange} /></Col>
                    <Col md={6}><Form.Label className="small fw-bold text-muted">Tramo</Form.Label><Select options={tramosOpts} placeholder="Tramo..." value={selectedTramo} onChange={setSelectedTramo} isDisabled={!selectedZona} /></Col>
                    <Col md={6}><Form.Label className="small fw-bold text-muted">Fechas</Form.Label><DatePicker selectsRange startDate={startDate} endDate={endDate} onChange={(update) => setDateRange(update)} className="form-control" placeholderText="Inicio - Fin" dateFormat="dd/MM/yyyy" /></Col>
                    
                    {/* --- AQUÍ ESTÁ EL CAMBIO DE CANTIDADES SPLIT --- */}
                    {isExecutionPhase ? (
                        <>
                            {/* CANTIDADES */}
                            <Col md={3}>
                                <Form.Label className="small fw-bold text-muted">Cant. Asignada (Plan)</Form.Label>
                                <Form.Control type="number" value={cantidadAsignada} disabled className="bg-light" />
                            </Col>
                            <Col md={3}>
                                <Form.Label className="small fw-bold text-success">Cant. Real (Ejecutado)</Form.Label>
                                <Form.Control 
                                        type="number" 
                                        value={cantidadReal} 
                                        onChange={e => setCantidadReal(e.target.value)} 
                                        className="border-success fw-bold" 
                                        disabled={editingTask?.estado === 'APROBADA'}
                                        autoFocus={editingTask?.estado !== 'APROBADA'}
                                    />
                            </Col>

                            {/* NUEVOS INPUTS: PUNTAS */}
                            <Col md={3}>
                                <Form.Label className="small fw-bold text-primary">Punta Inicio</Form.Label>
                                <Form.Control 
                                    size="sm"
                                    placeholder="Ej: Poste 10" 
                                    value={puntaInicio} 
                                    onChange={e => setPuntaInicio(e.target.value)} 
                                    disabled={editingTask?.estado === 'APROBADA'}
                                />
                            </Col>
                            <Col md={3}>
                                <Form.Label className="small fw-bold text-primary">Punta Final</Form.Label>
                                <Form.Control 
                                    size="sm"
                                    placeholder="Ej: Cámara 2" 
                                    value={puntaFinal} 
                                    onChange={e => setPuntaFinal(e.target.value)} 
                                    disabled={editingTask?.estado === 'APROBADA'}
                                />
                            </Col>

                            {/* BOTÓN GEOLOCALIZACIÓN */}
                            <Col md={12} className="mt-2">
                                <div className="d-flex align-items-center gap-2 bg-light p-2 rounded border">
                                    <Button 
                                        variant={geoData.coords || geoData.fotoUrl || geoData.foto ? "success" : "outline-secondary"}
                                        size="sm" 
                                        onClick={() => setShowGeoModal(true)}
                                        disabled={editingTask?.estado === 'APROBADA'}
                                    >
                                        <i className="bi bi-geo-alt-fill me-2"></i>
                                        {geoData.coords || geoData.fotoUrl || geoData.foto ? "Datos Geo Cargados" : "Agregar Geolocalización"}
                                    </Button>
                                    
                                    {(geoData.coords || geoData.lat) && (
                                        <span className="small text-muted font-monospace text-truncate">
                                            <i className="bi bi-pin-map me-1"></i>
                                            {geoData.coords || `${geoData.lat}, ${geoData.lon}`}
                                        </span>
                                    )}
                                </div>
                            </Col>
                        </>
                    ) : (
                        // ... (Caso normal 'Asignada') ...
                        <Col md={6}>
                            <Form.Label className="small fw-bold text-muted">Cantidad Asignada</Form.Label>
                            <Form.Control type="number" value={cantidadAsignada} onChange={e => setCantidadAsignada(e.target.value)} placeholder="0" />
                        </Col>
                    )}
                </Row>
                
                {/* 4. RESUMEN FINANCIERO */}
                <div className={`mt-4 p-3 rounded border ${finanzas.valid ? 'bg-light' : 'bg-light'}`}>
                    {finanzas.valid ? (
                        <>
                            <div className="d-flex justify-content-between mb-2 border-bottom pb-2">
                                <span className="small text-muted">Unitario:</span>
                                <div className="d-flex gap-3"><span className="small">Costo: <strong>${finanzas.costoUnit.toLocaleString()}</strong></span><span className="small">Venta: <strong>${finanzas.ventaUnit.toLocaleString()}</strong></span></div>
                            </div>
                            <div className="d-flex justify-content-around text-center">
                                <div><small className="d-block text-uppercase" style={{fontSize:'10px'}}>{isExecutionPhase ? 'Pago Real' : 'Pago Estimado'}</small><span className="fw-bold fs-5">${finanzas.totalCosto.toLocaleString()}</span></div>
                                <div><small className="d-block text-uppercase" style={{fontSize:'10px'}}>{isExecutionPhase ? 'Venta Real' : 'Venta Estimada'}</small><span className="fw-bold text-primary fs-5">${finanzas.totalVenta.toLocaleString()}</span></div>
                            </div>
                        </>
                    ) : (<div className="text-center text-danger small fw-bold">{tarifaCheck.msg}</div>)}
                </div>

                <div className="mt-3"><Form.Label className="small fw-bold text-muted">Plano / Evidencia</Form.Label><Form.Control type="file" size="sm" onChange={e => setArchivo(e.target.files[0])} />{archivoUrlExistente && <div className="small mt-1"><a href={archivoUrlExistente} target="_blank" rel="noreferrer">Ver archivo actual</a></div>}</div>

                {/* SECCIÓN MATERIALES (Visible en Ejecución y Aprobada, pero editable solo en Ejecución) */}
                {editingTask && editingTask.estado !== 'ASIGNADA' && (
                    <div className="mt-4 border-top pt-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold text-secondary mb-0">
                                <i className="bi bi-box-seam me-2"></i>Materiales Instalados
                            </h6>
                            {/* Solo mostramos el aviso si NO se puede editar (ej: en Aprobada) */}
                            {editingTask?.estado !== 'REALIZADA' && (
                                <Badge bg="light" text="dark" className="border">
                                    <i className="bi bi-lock-fill me-1"></i>Solo Lectura
                                </Badge>
                            )}
                        </div>
                        
                        {/* 1. EL FORMULARIO PARA AGREGAR (Solo visible si está en REALIZADA) */}
                        {editingTask?.estado === 'REALIZADA' && (
                            <div className="d-flex gap-2 mb-3 align-items-end bg-light p-2 rounded">
                                <div className="flex-grow-1">
                                    <label className="small text-muted">Material Disponible</label>
                                    <Select 
                                        options={materialesDisponibles} 
                                        value={selMaterial} 
                                        onChange={setSelMaterial}
                                        placeholder="Selecciona de tu bodega..."
                                        noOptionsMessage={() => "Sin stock asignado"}
                                        // Bloqueamos el select si no es REALIZADA (seguridad extra)
                                        isDisabled={editingTask.estado !== 'REALIZADA'}
                                    />
                                </div>
                                <div style={{width: '100px'}}>
                                    <label className="small text-muted">Cantidad</label>
                                    <Form.Control 
                                        type="number" 
                                        value={cantMaterial} 
                                        onChange={e => setCantMaterial(e.target.value)} 
                                    />
                                </div>
                                <Button 
                                    variant="outline-primary" 
                                    onClick={handleAddMaterial} 
                                    disabled={!selMaterial || editingTask.estado !== 'REALIZADA'}
                                >
                                    <i className="bi bi-plus-lg"></i>
                                </Button>
                            </div>
                        )}

                        {/* 2. LA LISTA DE CONSUMOS (Siempre visible, pero el botón borrar condicionado) */}
                        <div className="table-responsive border rounded" style={{maxHeight: '150px'}}>
                            <table className="table table-sm table-striped mb-0 small">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th className="text-end">Cant.</th>
                                        {/* La columna borrar solo aparece si estamos en REALIZADA */}
                                        {editingTask?.estado === 'REALIZADA' && <th></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {consumosTarea.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.nombre_producto}</td>
                                            <td className="text-end font-monospace">{c.cantidad} {c.unidad}</td>
                                            
                                            {/* BOTÓN BORRAR: Solo si es REALIZADA */}
                                            {editingTask?.estado === 'REALIZADA' && (
                                                <td className="text-end" style={{width:'30px'}}>
                                                    <i 
                                                        className="bi bi-trash text-danger cursor-pointer" 
                                                        onClick={() => handleDeleteMaterial(c.id)}
                                                        title="Eliminar consumo"
                                                    ></i>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {consumosTarea.length === 0 && (
                                        <tr>
                                            <td colSpan={editingTask?.estado === 'REALIZADA' ? "3" : "2"} className="text-center text-muted fst-italic">
                                                Sin materiales declarados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                    <div className="d-grid gap-2 mt-4 d-md-flex justify-content-md-end">
                    {isEditing && editingTask?.estado === 'ASIGNADA' && (<Button variant="outline-danger" onClick={handleDelete} className="me-md-auto"><i className="bi bi-trash me-2"></i>Eliminar</Button>)}
                    <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                    <Button variant="primary" type="submit" disabled={!finanzas.valid || uploading}>{uploading ? 'Guardando...' : 'Guardar Cambios'}</Button>
                </div>
            </Form>
        </Modal.Body>
      </Modal>
      {/* MODAL SECUNDARIO: GEOLOCALIZACIÓN */}
      <Modal show={showGeoModal} onHide={() => setShowGeoModal(false)} centered size="sm">
          <Modal.Header closeButton className="bg-light py-2">
              <Modal.Title className="h6 fw-bold">Georreferencia</Modal.Title>
          </Modal.Header>
          <Modal.Body>
              <Form.Group className="mb-2">
                  <Form.Label className="small text-muted mb-1">Coordenadas Completas</Form.Label>
                  <Form.Control 
                      size="sm" 
                      placeholder="-33.455028, -70.659741"
                      value={geoData.coords}
                      onChange={e => {
                          const val = e.target.value;
                          setGeoData({...geoData, coords: val});
                          if(val.includes(',')) {
                              const [l, g] = val.split(',').map(s => s.trim());
                              if(!isNaN(parseFloat(l)) && !isNaN(parseFloat(g))) {
                                  setGeoData(prev => ({...prev, coords: val, lat: l, lon: g}));
                              }
                          }
                      }}
                  />
                  <Form.Text className="text-muted" style={{fontSize: '0.7rem'}}>Copiar/Pegar desde Maps</Form.Text>
              </Form.Group>
              
              <Row className="g-2 mb-2">
                  <Col xs={6}>
                      <Form.Label className="small text-muted mb-1">Latitud</Form.Label>
                      <Form.Control size="sm" placeholder="-33.455" value={geoData.lat} onChange={e => setGeoData({...geoData, lat: e.target.value})} />
                  </Col>
                  <Col xs={6}>
                      <Form.Label className="small text-muted mb-1">Longitud</Form.Label>
                      <Form.Control size="sm" placeholder="-70.659" value={geoData.lon} onChange={e => setGeoData({...geoData, lon: e.target.value})} />
                  </Col>
              </Row>

              {/* --- AQUÍ ESTÁ LA MAGIA DEL MAPA --- */}
              {(geoData.lat && geoData.lon && !isNaN(parseFloat(geoData.lat)) && !isNaN(parseFloat(geoData.lon))) && (
                  <div className="my-3 border rounded overflow-hidden shadow-sm position-relative">
                      <div className="position-absolute top-0 start-0 m-2 badge bg-white text-primary shadow-sm border">
                          <i className="bi bi-geo-alt-fill me-1 text-danger"></i>Ubicación Detectada
                      </div>
                      
                      <iframe 
                          width="100%" 
                          height="180" 
                          frameBorder="0" 
                          style={{border:0}}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${geoData.lat},${geoData.lon}&z=16&output=embed`}
                      >
                      </iframe>
                  </div>
              )}
              {/* ----------------------------------- */}

              <Form.Group className="mb-3 border-top pt-2">
                  <Form.Label className="small fw-bold mb-1"><i className="bi bi-camera me-1"></i>Evidencia / Foto</Form.Label>
                  <Form.Control type="file" size="sm" accept="image/*" onChange={e => setGeoData({...geoData, foto: e.target.files[0]})} />
                  
                  {/* Previsualización de FOTO (Igual que antes) */}
                  {!geoData.foto && geoData.fotoUrl && (
                      <div className="mt-2 text-center bg-light p-1 rounded position-relative">
                          <img src={geoData.fotoUrl} alt="Geo Ref" style={{maxHeight: '100px', maxWidth: '100%'}} className="rounded"/>
                          <div className="small text-success mt-1"><i className="bi bi-check-circle-fill me-1"></i>Evidencia Guardada</div>
                      </div>
                  )}
              </Form.Group>
          </Modal.Body>
          <Modal.Footer className="py-1">
              <Button size="sm" variant="secondary" onClick={() => setShowGeoModal(false)}>Cerrar</Button>
              <Button size="sm" variant="primary" onClick={() => setShowGeoModal(false)}>Confirmar Datos</Button>
          </Modal.Footer>
      </Modal>
    </div>
  )
}

const KanbanColumn = ({ id, title, color, tasks, onDblClick, onQuickConfirm, onEmitirFromTask }) => (
    <div className="d-flex flex-column h-100 rounded-3 shadow-sm" style={{flex: '1 1 0px', minWidth: '250px', backgroundColor: '#ebecf0', padding: '8px'}}>
        <div className="d-flex align-items-center justify-content-between mb-2 px-1"><span className="fw-bold text-dark small text-uppercase">{title}</span><span className="badge bg-secondary rounded-pill text-white">{tasks.length}</span></div>
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className={`flex-grow-1 ${snapshot.isDraggingOver ? 'bg-secondary bg-opacity-25' : ''}`} style={{overflowY: 'auto', minHeight: '100px', borderRadius: '4px'}}>
                    {tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-2" onDoubleClick={() => onDblClick(task)}>
                                    <Card className={`border-0 shadow-sm task-card-hover ${id === 'APROBADA' ? 'bg-success bg-opacity-10 border border-success' : ''}`}>
                                        <Card.Body className="p-3">
                                            {/* ... (Cabecera con fechas y badge EP igual que antes) ... */}
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <Badge bg={id==='APROBADA'?'success':'light'} text={id==='APROBADA'?'white':'dark'} className="border fw-normal d-flex align-items-center gap-1"><i className="bi bi-calendar3"></i>{task.fecha_asignacion ? format(parseISO(task.fecha_asignacion), 'dd/MM') : '--'}</Badge>
                                                {task.estado_pago && <Badge bg="dark" className="ms-2">EP: {task.estado_pago.codigo}</Badge>}
                                            </div>

                                            {/* ... (Cuerpo de la tarjeta igual que antes) ... */}
                                            <div className="mb-2"><h6 className="fw-bold text-dark mb-0">{task.actividad?.nombre || task.sub_actividad?.nombre}</h6><small className="text-muted">{task.proveedor?.nombre}</small></div>
                                            <div className="d-flex gap-1 mb-2"><span className="badge bg-secondary bg-opacity-10 text-dark border">{task.zona?.nombre}</span><span className="badge bg-secondary bg-opacity-10 text-muted border">{task.tramo?.nombre}</span></div>
                                            
                                            {/* PIE DE TARJETA: Aquí agregamos el botón de Emitir */}
                                            <div className="border-top pt-2 mt-2 d-flex justify-content-between align-items-end">
                                                <div className="lh-1"><span className="d-block small">Plan: <strong>{task.cantidad_asignada}</strong></span><span className={`d-block small ${task.cantidad_real ? 'text-success fw-bold' : 'text-muted'}`}>Real: {task.cantidad_real || '-'}</span></div>
                                                
                                                {/* BOTÓN CHECK RÁPIDO (EXISTENTE) */}
                                                {(id === 'ASIGNADA' || id === 'REALIZADA') && (<Button variant="outline-success" size="sm" className="rounded-circle p-0" style={{width: '28px', height: '28px'}} onClick={(e) => onQuickConfirm(e, task)}><i className="bi bi-check-lg"></i></Button>)}
                                                
                                                {/* 🔥 BOTÓN DE EMISIÓN (NUEVO - SOLO EN APROBADA) */}
                                                {id === 'APROBADA' && (
                                                    <Button 
                                                        variant="primary" 
                                                        size="sm" 
                                                        className="py-0 px-2 shadow-sm" 
                                                        style={{fontSize: '0.75rem', height: '24px'}}
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Para que no abra el editar
                                                            onEmitirFromTask(task);
                                                        }}
                                                    >
                                                        <i className="bi bi-cash-stack me-1"></i>Emitir
                                                    </Button>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    </div>
)
export default AsignarTareas