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
import DocumentoOT from '../../components/pdf/DocumentoOT' // <--- IMPORTAR PDF NUEVO
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
import { whatsappService } from '../../services/whatsappService' // <--- NUEVO
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

  // --- NUEVOS ESTADOS PARA MULTI-ITEM ---
  const [taskList, setTaskList] = useState([]) 
  const [tempItem, setTempItem] = useState(null)

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

    // Helper: construir prefijo limpio del proyecto para códigos EP
    // El campo real de la tabla proyectos es "proyecto" (ej: "TCHFONSUR2023")
    const getProyectoCodigoBase = () => {
        // Prioridad: proyecto > codigo > nombre > projectId
        const raw = proyectoInfo?.proyecto 
            || proyectoInfo?.codigo 
            || proyectoInfo?.nombre 
            || String(projectId)
        return String(raw).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    }

    const loadInitialData = async () => {
        try {
            // Cargamos cada servicio por separado para identificar fallos
            let t = [], c = [], a = [], z = [], p = null, todosLosEPs = []
            
            // 1. Cuadrillas (Contratistas)
            try {
                c = await cuadrillasService.getCuadrillasProyecto(projectId)
            } catch (e) { console.error('Error cargando cuadrillas:', e) }
            
            // 2. Actividades
            try {
                a = await actividadesService.getActividades(projectId)
            } catch (e) { console.error('Error cargando actividades:', e) }
            
            // 3. Zonas
            try {
                z = await zonasService.getZonas(projectId)
            } catch (e) { console.error('Error cargando zonas:', e) }
            
            // 4. Proyecto Info
            try {
                p = await proyectosService.getById(projectId)
            } catch (e) { console.error('Error cargando proyecto:', e) }
            
            // 5. Estados de Pago
            try {
                todosLosEPs = await estadosPagoService.getAll(projectId)
            } catch (e) { console.error('Error cargando EPs:', e) }
            
            // 6. Tareas
            try {
                t = await tareasService.getTareas(projectId)
            } catch (e) { 
                console.error('Error cargando tareas:', e) 
                t = []
            }

            // Aplicar datos a estados
            setTareas(t || [])
            setCuadrillasOpts((c || []).map(x => ({ value: x.proveedor?.id, label: x.proveedor?.nombre })).filter(x => x.value))
            const listaProvs = (c || []).map(x => x.proveedor).filter(Boolean)
            setProveedoresFull(listaProvs)
            setZonasOpts((z || []).map(x => ({ value: x.id, label: x.nombre })))
            setActividadesData(a || [])
            setProyectoInfo(p)
            setEpsRawData(todosLosEPs || [])
            
        } catch (err) { 
            console.error('Error en loadInitialData:', err) 
        }
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
            const handleFileChange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        alert("⚠️ ADVERTENCIA: El archivo supera los 10MB.\n\nEsto puede hacer lento el envío y la descarga. Se recomienda comprimir o usar archivos menores a 5MB.");
                    }
                    setArchivo(file);
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

  // CÁLCULO FINANCIERO (MULTI-ITEM)
  useEffect(() => {
    let totalC = 0
    let totalV = 0
    
    // Recorremos la lista de actividades agregadas para sumar
    taskList.forEach(item => {
        const isRealPhase = isEditing && editingTask?.estado !== 'ASIGNADA'
        const qty = isRealPhase ? (Number(item.cantidad_real) || 0) : (Number(item.cantidad_asignada) || 0)
        
        totalC += (item.precio_costo || 0) * qty
        totalV += (item.precio_venta || 0) * qty
    })
    
    // Validamos si hay algo en la lista para dar el OK
    const isValid = taskList.length > 0;
    
    setFinanzas({ 
        costoUnit: 0, // Ya no aplica unitario global
        ventaUnit: 0, 
        totalCosto: totalC, 
        totalVenta: totalV, 
        valid: isValid 
    })
    
    // Actualizamos el check visual
    setTarifaCheck({ 
        checking: false, 
        valido: isValid, 
        msg: isValid ? 'OK' : 'Agrega actividades' 
    })

  }, [taskList, isEditing, editingTask]) 


  // --- ACTIONS EP ---
  const handleCreateNextEP = async () => {
      if(!editingTask) return
      if(!window.confirm(`¿Generar nuevo EP exclusivo para ${editingTask.proveedor?.nombre}?`)) return
      try {
          // Obtener prefijo del proyecto (usa `proyectoInfo.codigo` preferente)
          const codigoBase = `EP-${getProyectoCodigoBase()}`

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

  // --- MANEJO DE ITEMS DE LA LISTA ---
  const handleAddItem = async () => {
      if(!tempItem || !selectedCuadrilla) return alert("Selecciona actividad y contratista primero")
      
      let precioCosto = 0
      try {
          const tarifas = await actividadesService.getTarifas(projectId, tempItem.value, tempItem.type)
          const tarifaPactada = tarifas.find(t => t.proveedor.id === selectedCuadrilla.value)
          if(tarifaPactada) precioCosto = Number(tarifaPactada.valor_costo)
          else if(!window.confirm("⚠️ No hay tarifa pactada. ¿Agregar con costo $0?")) return
      } catch(e) { console.error(e) }

      const newItem = {
          uniqueId: Date.now(),
          value: tempItem.value,
          label: tempItem.label,
          type: tempItem.type,
          precio_venta: tempItem.precioVenta,
          precio_costo: precioCosto,
          cantidad_asignada: 1, 
          cantidad_real: 0,
          data: tempItem.data // Guardamos la info completa (requiere_material, etc)
      }
      
      setTaskList([...taskList, newItem])
      setTempItem(null)
  }

  const handleRemoveItem = (uniqueId) => {
      setTaskList(taskList.filter(i => i.uniqueId !== uniqueId))
  }

  const handleItemChange = (uniqueId, field, val) => {
      setTaskList(taskList.map(i => i.uniqueId === uniqueId ? { ...i, [field]: val } : i))
  }

  // --- SAVE (MULTI-ITEM) ---
  const handleSave = async (e) => {
    e.preventDefault()
    if(taskList.length === 0) return alert("Debes agregar al menos una actividad a la lista.")

    // 1. VALIDACIÓN DE MATERIALES (Bloqueo Estricto)
    const isExecution = editingTask?.estado && editingTask?.estado !== 'ASIGNADA';
    if (isExecution) {
        // Revisamos si ALGUNO de los items requiere material
        const algunoRequiere = taskList.some(item => item.data?.requiere_material);
        const tieneConsumos = consumosTarea.length > 0;

        if (algunoRequiere && !tieneConsumos) {
            alert("⚠️ BLOQUEO: Una de las actividades requiere material.\nDebes agregar materiales en la sección inferior antes de guardar.");
            return;
        }
    }

    setUploading(true)
    try {
        let fileUrl = archivoUrlExistente
        if(archivo) fileUrl = await storageService.subirArchivo(archivo)
        
        let geoFotoFinalUrl = geoData.fotoUrl;
        if (geoData.foto) geoFotoFinalUrl = await storageService.subirArchivo(geoData.foto);

        if (selectedEP) await estadosPagoService.asignarDueño(selectedEP.value, selectedCuadrilla?.value || editingTask?.proveedor_id)

        // Payload Cabecera (La tarea contenedora)
        const payloadTarea = {
            proyecto_id: Number(projectId),
            proveedor_id: selectedCuadrilla?.value || editingTask?.proveedor_id,
            zona_id: selectedZona.value,
            tramo_id: selectedTramo?.value,
            fecha_asignacion: startDate,
            fecha_estimada_termino: endDate,
            archivo_plano_url: fileUrl,
            comentarios_asignacion: comentarios,
            estado_pago_id: editingTask?.estado_pago_id || selectedEP?.value || null,
            punta_inicio: puntaInicio || null,
            punta_final: puntaFinal || null,
            geo_coords: geoData.coords || null,
            geo_lat: geoData.lat || null,
            geo_lon: geoData.lon || null,
            geo_foto_url: geoFotoFinalUrl || null,
            
            // Valores globales en 0 o resumen (la data real está en los items)
            cantidad_asignada: 0, 
            precio_costo_unitario: 0,
            precio_venta_unitario: 0
        }

        if (isEditing && editingTask?.estado !== 'ASIGNADA') {
            if(!editingTask.fecha_termino_real) payloadTarea.fecha_termino_real = new Date()
        }

        // Payload Items (El detalle)
        const payloadItems = taskList.map(item => ({
            actividad_id: item.type === 'ACT' ? item.value : null,
            sub_actividad_id: item.type === 'SUB' ? item.value : null,
            cantidad_asignada: item.cantidad_asignada,
            cantidad_real: item.cantidad_real,
            precio_costo: item.precio_costo,
            precio_venta: item.precio_venta
        }))

        // Llamamos al servicio actualizado (que maneja cabecera + items)
        if(isEditing) {
            await tareasService.actualizarTareaCompleta(editingTask.id, payloadTarea, payloadItems)
        } else {
            payloadTarea.estado = 'ASIGNADA'
            await tareasService.crearTarea(payloadTarea, payloadItems)
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
            
            // 2. CORRECCIÓN: Si vuelve a 'ASIGNADA', limpiamos TODO lo realizado
            if(newStatus === 'ASIGNADA' && oldStatus !== 'ASIGNADA') {
                // Limpiamos los valores numéricos/IDs de ejecución
                updatedTask.cantidad_real = null
                updatedTask.fecha_termino_real = null
                updatedTask.estado_pago_id = null

                // 🔥 Borramos el OBJETO visual para que desaparezca la etiqueta "EP:..." de la tarjeta
                updatedTask.estado_pago = null
                // --- BORRADO VISUAL DE CAMPOS DE EJECUCIÓN ---
                updatedTask.punta_inicio = null;
                updatedTask.punta_final = null;
                updatedTask.geo_coords = null;
                updatedTask.geo_lat = null;
                updatedTask.geo_lon = null;
                updatedTask.geo_foto_url = null;
                
                // 🔥 Limpiar cantidad_real en los items visualmente
                if (updatedTask.items && updatedTask.items.length > 0) {
                    updatedTask.items = updatedTask.items.map(item => ({
                        ...item,
                        cantidad_real: 0
                    }));
                }
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

            // 🔥 RESETEAR EJECUCIÓN: Limpiar cantidad_real en items y eliminar consumos de materiales
            try {
                await tareasService.resetearEjecucion(movedId);
            } catch (errReset) {
                console.error('Error reseteando ejecución:', errReset);
            }
        }

        // 🔥 NUEVA LÓGICA: ASIGNACIÓN AUTOMÁTICA AL ENTRAR A APROBADA
        if (newStatus === 'APROBADA' && oldStatus !== 'APROBADA') {
            // 1. Buscamos la tarea completa para saber quién es el proveedor
            const tareaActual = tareas.find(t => t.id === movedId);
            if (tareaActual) {
                try {
                    // 2. Obtenemos el prefijo limpio del proyecto para el código
                    const codigoBase = `EP-${getProyectoCodigoBase()}`;

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
    // Reset lista de items multi-tarea
    setTaskList([])
    setTempItem(null)
    setShowModal(true)
  }

  const openEditModal = async (task) => {
    setIsEditing(true)
    setEditingTask(task)
    setSelectedCuadrilla(cuadrillasOpts.find(c => c.value === task.proveedor_id))
    
    // --- CARGAR ÍTEMS MULTI-TAREA ---
    if(task.items && task.items.length > 0) {
        const loadedItems = task.items.map(i => ({
            uniqueId: i.id, 
            value: i.actividad?.id || i.sub_actividad?.id,
            label: i.actividad?.nombre || i.sub_actividad?.nombre,
            type: i.actividad ? 'ACT' : 'SUB',
            precio_venta: i.precio_venta_unitario || i.precio_venta,
            precio_costo: i.precio_costo_unitario || i.precio_costo,
            cantidad_asignada: i.cantidad_asignada,
            cantidad_real: i.cantidad_real || 0,
            data: i.actividad || i.sub_actividad // Importante para saber si requiere material
        }))
        setTaskList(loadedItems)
    } else {
        // Fallback: Si no hay items pero sí hay actividad directa (tareas antiguas)
        if(task.actividad_id || task.sub_actividad_id) {
            const act = task.actividad || task.sub_actividad
            if(act) {
                setTaskList([{
                    uniqueId: Date.now(),
                    value: act.id,
                    label: act.nombre,
                    type: task.actividad_id ? 'ACT' : 'SUB',
                    precio_venta: task.precio_venta_unitario || act.valor_venta || 0,
                    precio_costo: task.precio_costo_unitario || 0,
                    cantidad_asignada: task.cantidad_asignada || 0,
                    cantidad_real: task.cantidad_real || 0,
                    data: act
                }])
            } else {
                setTaskList([])
            }
        } else {
            setTaskList([]) 
        }
    }
    setTempItem(null)
    // ------------------------------------------
    
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
    
    // CARGAR CANTIDADES (Legacy - mantener por compatibilidad)
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

      {/* MODAL - DISEÑO PROFESIONAL */}
    <Modal show={showModal} onHide={handleCloseModal} size="xl" centered backdrop="static" className="modal-professional">
        <Modal.Header closeButton className="border-0 pb-0" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
            <Modal.Title className="text-white">
                <div className="d-flex align-items-center gap-3">
                    <div className="bg-white bg-opacity-25 rounded-circle p-2 d-flex align-items-center justify-content-center" style={{width: '42px', height: '42px'}}>
                        <i className={`bi ${isEditing ? 'bi-pencil-square' : 'bi-plus-circle'} fs-5`}></i>
                    </div>
                    <div>
                        <h5 className="mb-0 fw-bold">{isEditing ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}</h5>
                        <small className="opacity-75">{proyectoInfo?.nombre || proyectoInfo?.proyecto || 'Proyecto'}</small>
                    </div>
                </div>
                {editingTask?.estado && (
                    <Badge 
                        bg={editingTask.estado === 'APROBADA' ? 'success' : editingTask.estado === 'REALIZADA' ? 'info' : 'light'} 
                        text={editingTask.estado === 'ASIGNADA' ? 'dark' : 'white'}
                        className="ms-3 px-3 py-2"
                    >
                        {editingTask.estado}
                    </Badge>
                )}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
            <Form onSubmit={handleSave}>
                
                {/* SECCIÓN PAGO (Oculta por defecto) */}
                {showPaymentSection && (
                    <div className="bg-success bg-opacity-10 border-bottom border-success p-4">
                        <h6 className="fw-bold text-success mb-3"><i className="bi bi-cash-stack me-2"></i>Asignación a Estado de Pago</h6>
                        <Row className="g-2 align-items-end">
                            <Col md={7}>
                                <Form.Label className="small fw-bold text-muted">EP Disponible</Form.Label>
                                <div className="d-flex gap-2">
                                    <div className="flex-grow-1">
                                        <Select options={getCompatibleEPs()} placeholder="Seleccione..." value={selectedEP} onChange={setSelectedEP} isClearable />
                                    </div>
                                    {selectedEP && <Button variant="outline-secondary" onClick={handleEditEPCode}><i className="bi bi-pencil"></i></Button>}
                                </div>
                            </Col>
                            <Col md={5}><Button variant="success" className="w-100" onClick={handleCreateNextEP}><i className="bi bi-magic me-1"></i> Nuevo EP</Button></Col>
                        </Row>
                    </div>
                )}

                {/* DATOS PRINCIPALES - Layout horizontal limpio */}
                <div className="p-4 bg-light border-bottom">
                    <Row className="g-4">
                        <Col lg={6}>
                            <Form.Label className="small fw-semibold text-uppercase text-muted mb-2" style={{letterSpacing: '0.5px', fontSize: '11px'}}>
                                <i className="bi bi-person-badge me-1"></i>Contratista / Cuadrilla
                            </Form.Label>
                            <Select 
                                options={cuadrillasOpts} 
                                placeholder="Seleccionar contratista..." 
                                value={selectedCuadrilla} 
                                onChange={setSelectedCuadrilla} 
                                isDisabled={!canEditCore}
                                styles={{
                                    control: (base, state) => ({ 
                                        ...base, 
                                        minHeight: '44px',
                                        borderColor: state.isFocused ? '#667eea' : '#dee2e6',
                                        boxShadow: state.isFocused ? '0 0 0 3px rgba(102,126,234,0.15)' : 'none',
                                        '&:hover': { borderColor: '#667eea' }
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isSelected ? '#667eea' : state.isFocused ? '#f0f4ff' : 'white'
                                    })
                                }}
                            />
                        </Col>
                        <Col lg={6}>
                            <Form.Label className="small fw-semibold text-uppercase text-muted mb-2" style={{letterSpacing: '0.5px', fontSize: '11px'}}>
                                <i className="bi bi-calendar-range me-1"></i>Período de Ejecución
                            </Form.Label>
                            <DatePicker 
                                selectsRange 
                                startDate={startDate} 
                                endDate={endDate} 
                                onChange={(update) => setDateRange(update)} 
                                className="form-control py-2" 
                                placeholderText="Fecha inicio → Fecha fin" 
                                dateFormat="dd MMM yyyy"
                                locale={es}
                                wrapperClassName="w-100"
                            />
                        </Col>
                        <Col lg={6}>
                            <Form.Label className="small fw-semibold text-uppercase text-muted mb-2" style={{letterSpacing: '0.5px', fontSize: '11px'}}>
                                <i className="bi bi-geo me-1"></i>Zona de Trabajo
                            </Form.Label>
                            <Select 
                                options={zonasOpts} 
                                placeholder="Seleccionar zona..." 
                                value={selectedZona} 
                                onChange={handleZonaChange}
                                styles={{
                                    control: (base, state) => ({ 
                                        ...base, 
                                        minHeight: '44px',
                                        borderColor: state.isFocused ? '#667eea' : '#dee2e6',
                                        boxShadow: state.isFocused ? '0 0 0 3px rgba(102,126,234,0.15)' : 'none'
                                    })
                                }}
                            />
                        </Col>
                        <Col lg={6}>
                            <Form.Label className="small fw-semibold text-uppercase text-muted mb-2" style={{letterSpacing: '0.5px', fontSize: '11px'}}>
                                <i className="bi bi-signpost-split me-1"></i>Tramo / Sector
                            </Form.Label>
                            <Select 
                                options={tramosOpts} 
                                placeholder={selectedZona ? "Seleccionar tramo..." : "Primero selecciona zona"} 
                                value={selectedTramo} 
                                onChange={setSelectedTramo} 
                                isDisabled={!selectedZona}
                                styles={{
                                    control: (base, state) => ({ 
                                        ...base, 
                                        minHeight: '44px',
                                        borderColor: state.isFocused ? '#667eea' : '#dee2e6',
                                        boxShadow: state.isFocused ? '0 0 0 3px rgba(102,126,234,0.15)' : 'none',
                                        backgroundColor: !selectedZona ? '#f8f9fa' : 'white'
                                    })
                                }}
                            />
                        </Col>
                    </Row>
                </div>

                {/* SECCIÓN ACTIVIDADES - Rediseñada */}
                <div className="p-4">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                            <h6 className="fw-bold text-dark mb-1">
                                <i className="bi bi-list-check me-2 text-primary"></i>
                                Partidas / Actividades
                            </h6>
                            <small className="text-muted">Agrega las actividades que incluye esta orden de trabajo</small>
                        </div>
                        <Badge bg="primary" className="px-3 py-2">
                            {taskList.length} {taskList.length === 1 ? 'item' : 'items'}
                        </Badge>
                    </div>
                    
                    {/* Barra de búsqueda de actividades - Más espaciosa */}
                    {canEditCore && (
                        <div className="bg-gradient rounded-3 p-3 mb-4" style={{background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%)'}}>
                            <Row className="g-3 align-items-end">
                                <Col xs={12} md={3}>
                                    <Form.Label className="small fw-semibold text-muted mb-1">Tipo</Form.Label>
                                    <Select 
                                        options={[{value:'ACT', label:'Actividad'}, {value:'SUB', label:'Sub-Actividad'}]} 
                                        value={{value: inputType, label: inputType==='ACT'?'Actividad':'Sub-Actividad'}} 
                                        onChange={e => {setInputType(e.value); setTempItem(null)}} 
                                        isDisabled={!selectedCuadrilla}
                                        styles={{ 
                                            control: (base) => ({ ...base, minHeight: '42px', backgroundColor: 'white' }),
                                            singleValue: (base) => ({ ...base, fontWeight: 500 })
                                        }}
                                    />
                                </Col>
                                <Col xs={12} md={7}>
                                    <Form.Label className="small fw-semibold text-muted mb-1">Buscar Actividad</Form.Label>
                                    <Select 
                                        options={getItemOptions()} 
                                        placeholder={selectedCuadrilla ? "🔍 Escribe para buscar actividad..." : "⚠️ Primero selecciona un contratista"}
                                        value={tempItem} 
                                        onChange={setTempItem} 
                                        isDisabled={!selectedCuadrilla}
                                        noOptionsMessage={() => "No se encontraron actividades"}
                                        styles={{ 
                                            control: (base, state) => ({ 
                                                ...base, 
                                                minHeight: '42px',
                                                backgroundColor: 'white',
                                                borderColor: state.isFocused ? '#667eea' : '#dee2e6',
                                                boxShadow: state.isFocused ? '0 0 0 3px rgba(102,126,234,0.15)' : 'none'
                                            }),
                                            menu: (base) => ({ ...base, zIndex: 9999 }),
                                            option: (base, state) => ({
                                                ...base,
                                                padding: '12px 16px',
                                                backgroundColor: state.isSelected ? '#667eea' : state.isFocused ? '#f0f4ff' : 'white',
                                                cursor: 'pointer'
                                            })
                                        }}
                                    />
                                </Col>
                                <Col xs={12} md={2}>
                                    <Button 
                                        variant="primary" 
                                        className="w-100 d-flex align-items-center justify-content-center gap-2 shadow-sm" 
                                        style={{height: '42px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none'}}
                                        onClick={handleAddItem} 
                                        disabled={!tempItem}
                                    >
                                        <i className="bi bi-plus-lg"></i>
                                        <span className="d-none d-lg-inline">Agregar</span>
                                    </Button>
                                </Col>
                            </Row>
                        </div>
                    )}

                    {/* Lista de actividades agregadas */}
                    <div className="border rounded-3 overflow-hidden" style={{maxHeight: '280px', overflowY: 'auto'}}>
                        {taskList.length === 0 ? (
                            <div className="text-center py-5">
                                <i className="bi bi-inbox text-muted" style={{fontSize: '3rem', opacity: 0.3}}></i>
                                <p className="text-muted mt-3 mb-0">No hay actividades agregadas</p>
                                <small className="text-muted">Usa el buscador de arriba para agregar</small>
                            </div>
                        ) : (
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="bg-white sticky-top" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.08)'}}>
                                    <tr>
                                        <th className="ps-3 py-3 border-0 text-muted fw-semibold" style={{fontSize: '12px'}}>ACTIVIDAD</th>
                                        <th className="text-center py-3 border-0 text-muted fw-semibold" style={{width:'100px', fontSize: '12px'}}>PLAN</th>
                                        {isExecutionPhase && <th className="text-center py-3 border-0 text-success fw-semibold" style={{width:'100px', fontSize: '12px'}}>REAL</th>}
                                        <th className="text-end py-3 border-0 text-muted fw-semibold" style={{width:'110px', fontSize: '12px'}}>COSTO</th>
                                        <th className="py-3 border-0" style={{width:'50px'}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {taskList.map((item, idx) => (
                                        <tr key={item.uniqueId || idx} className="border-bottom" style={{transition: 'background 0.2s'}}>
                                            <td className="ps-3 py-3">
                                                <div className="d-flex align-items-start gap-2">
                                                    <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: '32px', height: '32px'}}>
                                                        <i className={`bi ${item.type === 'ACT' ? 'bi-layers' : 'bi-diagram-3'} text-primary`} style={{fontSize: '14px'}}></i>
                                                    </div>
                                                    <div className="flex-grow-1 min-width-0">
                                                        <div className="fw-medium text-dark" style={{lineHeight: '1.3'}}>{item.label}</div>
                                                        <div className="d-flex gap-2 mt-1">
                                                            <Badge bg="light" text="muted" className="fw-normal" style={{fontSize: '10px'}}>
                                                                {item.type === 'ACT' ? 'Actividad' : 'Sub-actividad'}
                                                            </Badge>
                                                            {item.data?.requiere_material && (
                                                                <Badge bg="warning" text="dark" style={{fontSize: '10px'}}>
                                                                    <i className="bi bi-box-seam me-1"></i>Req. Material
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-center py-3">
                                                <Form.Control 
                                                    type="number" 
                                                    size="sm" 
                                                    value={item.cantidad_asignada} 
                                                    onChange={e => handleItemChange(item.uniqueId, 'cantidad_asignada', e.target.value)} 
                                                    disabled={!canEditCore} 
                                                    className="text-center border-0 bg-light rounded fw-medium" 
                                                    style={{width:'70px', margin:'0 auto'}} 
                                                />
                                            </td>
                                            {isExecutionPhase && (
                                                <td className="text-center py-3">
                                                    <Form.Control 
                                                        type="number" 
                                                        size="sm" 
                                                        value={item.cantidad_real} 
                                                        onChange={e => handleItemChange(item.uniqueId, 'cantidad_real', e.target.value)} 
                                                        className="text-center border-success bg-success bg-opacity-10 rounded fw-bold text-success" 
                                                        style={{width:'70px', margin:'0 auto'}} 
                                                        disabled={editingTask?.estado === 'APROBADA'} 
                                                    />
                                                </td>
                                            )}
                                            <td className="text-end py-3 pe-2">
                                                <span className="fw-semibold text-dark">
                                                    ${( (isExecutionPhase ? item.cantidad_real : item.cantidad_asignada) * item.precio_costo ).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="text-center py-3">
                                                {canEditCore && (
                                                    <Button 
                                                        variant="link" 
                                                        className="p-1 text-danger" 
                                                        onClick={() => handleRemoveItem(item.uniqueId)}
                                                        title="Eliminar"
                                                    >
                                                        <i className="bi bi-x-circle"></i>
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* SECCIÓN EJECUCIÓN (Solo visible en fase de ejecución) */}
                {isExecutionPhase && (
                    <div className="px-4 pb-4">
                        <div className="bg-info bg-opacity-10 rounded-3 p-3 border border-info border-opacity-25">
                            <h6 className="fw-bold text-info mb-3">
                                <i className="bi bi-tools me-2"></i>Datos de Ejecución
                            </h6>
                            <Row className="g-3">
                                <Col md={3}>
                                    <Form.Label className="small fw-semibold text-muted mb-1">Punta Inicio</Form.Label>
                                    <Form.Control 
                                        placeholder="Ej: Poste 10" 
                                        value={puntaInicio} 
                                        onChange={e => setPuntaInicio(e.target.value)} 
                                        disabled={editingTask?.estado === 'APROBADA'}
                                        className="bg-white"
                                    />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-semibold text-muted mb-1">Punta Final</Form.Label>
                                    <Form.Control 
                                        placeholder="Ej: Cámara 2" 
                                        value={puntaFinal} 
                                        onChange={e => setPuntaFinal(e.target.value)} 
                                        disabled={editingTask?.estado === 'APROBADA'}
                                        className="bg-white"
                                    />
                                </Col>
                                <Col md={6}>
                                    <Form.Label className="small fw-semibold text-muted mb-1">Geolocalización</Form.Label>
                                    <div className="d-flex align-items-center gap-2">
                                        <Button 
                                            variant={geoData.coords || geoData.fotoUrl || geoData.foto ? "success" : "outline-secondary"}
                                            className="d-flex align-items-center gap-2"
                                            onClick={() => setShowGeoModal(true)}
                                            disabled={editingTask?.estado === 'APROBADA'}
                                        >
                                            <i className="bi bi-geo-alt-fill"></i>
                                            {geoData.coords || geoData.fotoUrl || geoData.foto ? "Geo Cargado ✓" : "Agregar Ubicación"}
                                        </Button>
                                        {(geoData.coords || geoData.lat) && (
                                            <code className="small text-muted bg-white px-2 py-1 rounded">
                                                {geoData.coords || `${geoData.lat}, ${geoData.lon}`}
                                            </code>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    </div>
                )}
                
                {/* RESUMEN FINANCIERO - Rediseñado */}
                <div className="px-4 pb-4">
                    <div className={`rounded-3 overflow-hidden ${finanzas.valid ? '' : 'border border-danger'}`} 
                         style={{background: finanzas.valid ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff5f5'}}>
                        {finanzas.valid ? (
                            <div className="p-4">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div className="text-white text-center flex-fill border-end border-white border-opacity-25">
                                        <small className="d-block text-uppercase text-white-50 mb-1" style={{fontSize:'10px', letterSpacing:'1px'}}>
                                            {isExecutionPhase ? 'COSTO REAL' : 'COSTO ESTIMADO'}
                                        </small>
                                        <span className="fw-bold fs-4">${finanzas.totalCosto.toLocaleString()}</span>
                                    </div>
                                    <div className="text-white text-center flex-fill">
                                        <small className="d-block text-uppercase text-white-50 mb-1" style={{fontSize:'10px', letterSpacing:'1px'}}>
                                            {isExecutionPhase ? 'VENTA REAL' : 'VENTA ESTIMADA'}
                                        </small>
                                        <span className="fw-bold fs-4">${finanzas.totalVenta.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 text-center">
                                <i className="bi bi-exclamation-triangle text-danger fs-4"></i>
                                <p className="text-danger mb-0 mt-2 fw-medium">{tarifaCheck.msg}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- SECCIÓN ARCHIVOS MEJORADA --- */}
                <div className="px-4 pb-4">
                    <Row className="g-3">
                        <Col md={6}>
                            <div className="mt-3 bg-light p-2 rounded border">
                                <Form.Label className="small fw-bold text-muted mb-1">
                                    <i className="bi bi-paperclip me-1"></i>Documentación Adjunta
                                </Form.Label>
                                <div className="d-flex gap-2 align-items-center">
                                    <Form.Control 
                                        type="file" 
                                        size="sm" 
                                        onChange={handleFileChange} // <--- USAR EL NUEVO HANDLER
                                    />
                                    {/* Botón descarga PDF (Solo si ya existe la tarea) */}
                                    {isEditing && editingTask?.id && (
                                        <PDFDownloadLink
                                            document={<DocumentoOT tarea={editingTask} items={taskList} proyecto={proyectoInfo} />}
                                            fileName={`OT_${editingTask?.id || 'nuevo'}_${editingTask?.proveedor?.nombre?.slice(0,10) || 'prov'}.pdf`}
                                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                                        >
                                            {({ loading }) => loading ? '...' : <><i className="bi bi-file-pdf"></i> OT</>}
                                        </PDFDownloadLink>
                                    )}
                                </div>
                                {archivoUrlExistente && (
                                    <div className="small mt-1 text-success">
                                        <i className="bi bi-check-circle me-1"></i>
                                        <a href={archivoUrlExistente} target="_blank" rel="noreferrer">Ver archivo actual</a>
                                    </div>
                                )}
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* SECCIÓN MATERIALES (Solo en ejecución) */}
                {editingTask && editingTask.estado !== 'ASIGNADA' && (
                    <div className="px-4 pb-4">
                        <div className="border rounded-3 overflow-hidden">
                            <div className="bg-light px-3 py-2 d-flex justify-content-between align-items-center border-bottom">
                                <h6 className="fw-bold text-secondary mb-0 small">
                                    <i className="bi bi-box-seam me-2"></i>Materiales Instalados
                                </h6>
                                {editingTask?.estado !== 'REALIZADA' && (
                                    <Badge bg="secondary" className="fw-normal">
                                        <i className="bi bi-lock-fill me-1"></i>Bloqueado
                                    </Badge>
                                )}
                            </div>
                        
                            {/* Formulario para agregar materiales */}
                            {editingTask?.estado === 'REALIZADA' && (
                                <div className="p-3 border-bottom bg-white">
                                    <Row className="g-2 align-items-end">
                                        <Col md={7}>
                                            <Form.Label className="small text-muted mb-1">Material Disponible</Form.Label>
                                            <Select 
                                                options={materialesDisponibles} 
                                                value={selMaterial} 
                                                onChange={setSelMaterial}
                                                placeholder="Selecciona de tu bodega..."
                                                noOptionsMessage={() => "Sin stock asignado"}
                                                isDisabled={editingTask.estado !== 'REALIZADA'}
                                                styles={{
                                                    control: (base) => ({ ...base, minHeight: '38px' })
                                                }}
                                            />
                                        </Col>
                                        <Col md={3}>
                                            <Form.Label className="small text-muted mb-1">Cantidad</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                value={cantMaterial} 
                                                onChange={e => setCantMaterial(e.target.value)}
                                                placeholder="0"
                                            />
                                        </Col>
                                        <Col md={2}>
                                            <Button 
                                                variant="primary" 
                                                className="w-100"
                                                onClick={handleAddMaterial} 
                                                disabled={!selMaterial || editingTask.estado !== 'REALIZADA'}
                                            >
                                                <i className="bi bi-plus-lg"></i>
                                            </Button>
                                        </Col>
                                    </Row>
                                </div>
                            )}

                            {/* Lista de consumos */}
                            <div style={{maxHeight: '120px', overflowY: 'auto'}}>
                                <table className="table table-sm mb-0 small align-middle">
                                    <tbody>
                                        {consumosTarea.map(c => (
                                            <tr key={c.id}>
                                                <td className="ps-3">{c.nombre_producto}</td>
                                                <td className="text-end font-monospace text-muted">{c.cantidad} {c.unidad}</td>
                                                {editingTask?.estado === 'REALIZADA' && (
                                                    <td className="text-end pe-3" style={{width:'40px'}}>
                                                        <Button variant="link" className="p-0 text-danger" onClick={() => handleDeleteMaterial(c.id)}>
                                                            <i className="bi bi-x-circle"></i>
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {consumosTarea.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="text-center text-muted py-3 fst-italic">
                                                    Sin materiales declarados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* FOOTER CON BOTONES */}
                <div className="px-4 py-3 bg-light border-top d-flex justify-content-between align-items-center">
                    <div className="d-flex gap-2">
                        {/* --- BOTÓN WHATSAPP (SIEMPRE VISIBLE SI HAY DATOS) --- */}
                        {(selectedCuadrilla || isEditing) && taskList.length > 0 && (
                            <Button 
                                variant="success" 
                                className="d-flex align-items-center gap-2 shadow-sm"
                                onClick={() => {
                                    const provData = proveedoresFull.find(p => p.id === (selectedCuadrilla?.value || editingTask?.proveedor_id));
                                    const telefono = provData?.telefono || provData?.fono || provData?.phone || provData?.celular;

                                    const tareaParaMensaje = {
                                        ...(editingTask || {}),
                                        fecha_asignacion: startDate,
                                        zona: selectedZona?.label || 'Sin zona',  // Pasar string directamente
                                        tramo: selectedTramo?.label || null,       // Pasar string directamente
                                        punta_inicio: puntaInicio,
                                        punta_final: puntaFinal,
                                        geo_lat: geoData.lat,
                                        geo_lon: geoData.lon,
                                        archivo_plano_url: archivoUrlExistente     // URL del archivo adjunto
                                    };

                                    whatsappService.enviarOT(telefono, tareaParaMensaje, taskList, proyectoInfo);
                                }}
                                title="Enviar Orden de Trabajo por WhatsApp"
                            >
                                <i className="bi bi-whatsapp"></i> <span className="d-none d-md-inline">Enviar OT</span>
                            </Button>
                        )}
                        {/* ---------------------------------------------------- */}
                        
                        {isEditing && editingTask?.estado === 'ASIGNADA' && (
                            <Button variant="outline-danger" onClick={handleDelete} className="d-flex align-items-center gap-2">
                                <i className="bi bi-trash"></i>
                                <span>Eliminar</span>
                            </Button>
                        )}
                    </div>
                    
                    <div className="d-flex gap-2">
                        <Button variant="light" onClick={handleCloseModal} className="px-4">
                            Cancelar
                        </Button>
                        <Button 
                            variant="primary" 
                            type="submit" 
                            disabled={!finanzas.valid || uploading}
                            className="px-4 d-flex align-items-center gap-2"
                            style={{background: finanzas.valid ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '', border: 'none'}}
                        >
                            {uploading ? (
                                <>
                                    <Spinner animation="border" size="sm" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check2-circle"></i>
                                    <span>{isEditing ? 'Actualizar' : 'Crear Orden'}</span>
                                </>
                            )}
                        </Button>
                    </div>
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
                                                {task.estado_pago && <Badge bg="dark" className="ms-2">{task.estado_pago.codigo}</Badge>}
                                            </div>

                                            {/* ... (Cuerpo de la tarjeta igual que antes) ... */}
                                            <div className="mb-2"><h6 className="fw-bold text-dark mb-0">{task.actividad?.nombre || task.sub_actividad?.nombre}</h6><small className="text-muted">{task.proveedor?.nombre}</small></div>
                                            <div className="d-flex gap-1 mb-2"><span className="badge bg-secondary bg-opacity-10 text-dark border">{task.zona?.nombre}</span><span className="badge bg-secondary bg-opacity-10 text-muted border">{task.tramo?.nombre}</span></div>
                                            
                                            {/* PIE DE TARJETA: Aquí agregamos el botón de Emitir */}
                                            <div className="border-top pt-2 mt-2 d-flex justify-content-between align-items-end">
                                                <div className="lh-1"><span className="d-block small">Plan: <strong>{task.items?.reduce((sum, i) => sum + (i.cantidad_asignada || 0), 0) || task.cantidad_asignada || 0}</strong></span><span className={`d-block small ${task.cantidad_real || task.items?.some(i => i.cantidad_real) ? 'text-success fw-bold' : 'text-muted'}`}>Real: {task.items?.reduce((sum, i) => sum + (i.cantidad_real || 0), 0) || task.cantidad_real || '-'}</span></div>
                                                
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