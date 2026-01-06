import React from 'react';
import Timeline, { TimelineHeaders, SidebarHeader, DateHeader } from 'react-calendar-timeline';
import moment from 'moment';
import 'moment/locale/es'; 
import './TimelineView.css'; 

moment.locale('es');

const FERIADOS_CHILE = [
  '2026-01-01', '2026-04-10', '2026-05-01', '2026-05-21', 
  '2026-06-20', '2026-07-16', '2026-08-15', '2026-09-18', 
  '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', 
  '2026-12-08', '2026-12-25'
];

const ROW_HEIGHT = 45;

const TimelineView = ({ tareas, proveedores, onEditTask, onResizeTask }) => {
  
  // 1. MAPEO PROVEEDORES
  const mapaProveedores = {};
  proveedores.forEach(p => {
      if(p && p.id) mapaProveedores[p.id] = p.nombre;
  });

  // Mapa de tareas para acceso rápido por ID
  const mapaTareas = {};
  tareas.forEach(t => { mapaTareas[t.id] = t; });

  // 2. AGRUPAR TAREAS POR PROVEEDOR
  const tareasPorProveedor = {};
  tareas.forEach(t => {
      const provId = t.proveedor_id;
      if(!provId) return;
      if (!tareasPorProveedor[provId]) tareasPorProveedor[provId] = [];
      tareasPorProveedor[provId].push(t);
  });

  const groups = [];
  const items = [];
  let minDate = moment().add(10, 'year'); 
  let hasTasks = false;

  const proveedorOverlays = [];
  let filaActual = 0;

  const parseFecha = (fechaStr) => {
      if (!fechaStr) return null;
      return moment(fechaStr.substring(0, 10), "YYYY-MM-DD");
  };

  // 3. GENERAR FILAS
  const proveedoresOrdenados = Object.keys(tareasPorProveedor).sort((a, b) => {
      const nombreA = mapaProveedores[a] || '';
      const nombreB = mapaProveedores[b] || '';
      return nombreA.localeCompare(nombreB);
  });

  proveedoresOrdenados.forEach(provId => {
      const listaTareas = tareasPorProveedor[provId];
      listaTareas.sort((a, b) => (a.fecha_asignacion || '').localeCompare(b.fecha_asignacion || ''));

      const nombreProv = mapaProveedores[provId] || `ID: ${provId}`;
      const totalTareas = listaTareas.length;
      const filaInicio = filaActual;

      proveedorOverlays.push({
          nombre: nombreProv,
          filaInicio: filaInicio,
          cantidadFilas: totalTareas
      });

      listaTareas.forEach((t, index) => {
          let nombreActividad = 'Sin Descripción';
          if (t.actividad && t.actividad.nombre) nombreActividad = t.actividad.nombre;
          else if (t.sub_actividad && t.sub_actividad.nombre) nombreActividad = t.sub_actividad.nombre;
          else if (t.item) nombreActividad = t.item;

          const esUltima = index === totalTareas - 1;

          groups.push({
              id: t.id,
              title: nombreActividad,
              customData: { esUltima, proveedorId: provId },
              height: ROW_HEIGHT
          });

          const start = parseFecha(t.fecha_asignacion);
          if (start) {
              hasTasks = true;
              if (start.isBefore(minDate)) minDate = start.clone();

              const fechaFinRaw = t.fecha_estimada_termino;
              const end = fechaFinRaw 
                  ? parseFecha(fechaFinRaw).add(1, 'day') 
                  : start.clone().add(1, 'day');

              let bgColor = '#10b981'; 
              let borderColor = '#047857';

              if (['PAGADA', 'EMITIDO'].includes(t.estado)) {
                  bgColor = '#6b7280'; borderColor = '#374151';
              } else if (t.estado === 'ASIGNADA') {
                  bgColor = '#f59e0b'; borderColor = '#d97706';
              }

              // Permitir resize solo si NO está pagada
              const canResizeThis = !['PAGADA', 'EMITIDO'].includes(t.estado);

              items.push({
                  id: t.id,
                  group: t.id,
                  title: nombreActividad,
                  start_time: start,
                  end_time: end,
                  canMove: false,
                  canResize: canResizeThis ? 'both' : false,
                  bgColor: bgColor,
                  borderColor: borderColor,
                  itemProps: {
                      style: {
                          background: bgColor,
                          borderColor: borderColor,
                          color: 'white',
                          borderRadius: '4px',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          cursor: 'pointer'
                      }
                  }
              });
          }

          filaActual++;
      });
  });

  const viewStart = hasTasks ? minDate.clone().subtract(3, 'days') : moment().subtract(3, 'days');
  const viewEnd = viewStart.clone().add(45, 'days');

  const styleDiasInhabiles = (start) => {
    const diaSemana = moment(start).day(); 
    const fechaStr = moment(start).format('YYYY-MM-DD');
    if (diaSemana === 0 || diaSemana === 6 || FERIADOS_CHILE.includes(fechaStr)) {
        return ['dia-inhabil'];
    }
    return [];
  };

  // HANDLER: Doble clic en una tarea
  const handleItemDoubleClick = (itemId) => {
      const tarea = mapaTareas[itemId];
      if (tarea && onEditTask) {
          onEditTask(tarea);
      }
  };

  // HANDLER: Resize de una tarea (cambiar fechas arrastrando)
  const handleItemResize = (itemId, time, edge) => {
      const tarea = mapaTareas[itemId];
      if (!tarea || !onResizeTask) return;

      // edge = 'left' (fecha inicio) o 'right' (fecha fin)
      const nuevaFecha = moment(time).format('YYYY-MM-DD');
      
      if (edge === 'left') {
          onResizeTask(tarea.id, { fecha_asignacion: nuevaFecha });
      } else {
          // Para fecha fin, restamos 1 día porque internamente agregamos 1
          const fechaReal = moment(time).subtract(1, 'day').format('YYYY-MM-DD');
          onResizeTask(tarea.id, { fecha_estimada_termino: fechaReal });
      }
  };

  if (groups.length === 0) return <div className="p-5 text-center text-muted">No hay datos para mostrar.</div>;

  const HEADER_HEIGHT = 60;

  return (
    <div className="border rounded shadow-sm bg-white p-0 overflow-hidden position-relative">
      
      {/* OVERLAY: Columna de proveedores con celdas combinadas */}
      <div 
        className="position-absolute" 
        style={{ 
          top: HEADER_HEIGHT, 
          left: 0, 
          width: '180px', 
          zIndex: 100,
          background: '#f1f5f9',
          borderRight: '2px solid #94a3b8'
        }}
      >
        {proveedorOverlays.map((prov, idx) => (
          <div
            key={idx}
            className="d-flex align-items-center justify-content-center text-center fw-bold"
            style={{
              height: prov.cantidadFilas * ROW_HEIGHT,
              borderBottom: '2px solid #64748b',
              fontSize: '11px',
              color: '#1e293b',
              padding: '4px',
              background: idx % 2 === 0 ? '#f1f5f9' : '#e2e8f0'
            }}
          >
            {prov.nombre}
          </div>
        ))}
      </div>

      <Timeline
        groups={groups}
        items={items}
        
        defaultTimeStart={viewStart}
        defaultTimeEnd={viewEnd}
        
        minZoom={24 * 60 * 60 * 1000 * 3}
        maxZoom={24 * 60 * 60 * 1000 * 120}
        
        lineHeight={ROW_HEIGHT}
        itemHeightRatio={0.75}
        stackItems={false}
        
        sidebarWidth={400}
        canMove={false}
        canResize={true}
        verticalLineClassNamesForTime={styleDiasInhabiles}
        
        onItemDoubleClick={handleItemDoubleClick}
        onItemResize={handleItemResize}
        
        groupRenderer={({ group }) => {
          const { esUltima } = group.customData;
          
          return (
            <div 
              className="d-flex h-100 align-items-center" 
              style={{
                borderBottom: esUltima ? '2px solid #64748b' : '1px solid #e2e8f0',
                background: 'white',
                paddingLeft: '185px'
              }}
            >
              <div 
                className="text-truncate fw-medium" 
                style={{ fontSize: '11px', color: '#475569', paddingRight: '10px' }}
                title={group.title}
              >
                {group.title}
              </div>
            </div>
          );
        }}
        
        itemRenderer={({ item, itemContext, getItemProps }) => {
          const { key, ...itemProps } = getItemProps({});
          // Sobrescribir los estilos con los colores correctos del item
          const customStyle = {
            ...itemProps.style,
            background: item.bgColor,
            backgroundColor: item.bgColor,
            borderColor: item.borderColor,
            color: 'white',
            borderRadius: '4px',
            borderWidth: '1px',
            borderStyle: 'solid',
            cursor: 'pointer'
          };
          
          return (
            <div
              key={key}
              {...itemProps}
              style={customStyle}
              title={`${item.title}\nDoble clic para editar | Arrastra los bordes para cambiar fechas`}
            >
              <div className="rct-item-content" style={{ 
                maxHeight: '100%', 
                overflow: 'hidden',
                padding: '0 6px',
                fontSize: '10px',
                fontWeight: '600'
              }}>
                {itemContext.useResizeHandle && <div className="rct-item-handler rct-item-handler-resize-left" />}
                {item.title}
                {itemContext.useResizeHandle && <div className="rct-item-handler rct-item-handler-resize-right" />}
              </div>
            </div>
          );
        }}
      >
        <TimelineHeaders className="bg-light" style={{ height: HEADER_HEIGHT }}>
          <SidebarHeader>
            {({ getRootProps }) => (
              <div {...getRootProps()} className="d-flex h-100 border-end bg-dark text-white fw-bold small">
                  <div className="d-flex align-items-center justify-content-center border-end border-secondary" style={{width: '180px'}}>
                      SUBCONTRATO
                  </div>
                  <div className="d-flex align-items-center justify-content-center" style={{width: '220px'}}>
                      ACTIVIDAD / TAREA
                  </div>
              </div>
            )}
          </SidebarHeader>

          <DateHeader 
            unit="primaryHeader"
            height={30}
            intervalRenderer={({ getIntervalProps, intervalContext }) => {
                const { key, ...props } = getIntervalProps();
                return (
                    <div 
                      key={key} 
                      {...props} 
                      style={{
                        ...props.style,
                        background: '#1e293b',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        textTransform: 'uppercase'
                      }}
                    >
                        {intervalContext.intervalText}
                    </div>
                );
            }}
          />
          <DateHeader 
            unit="day" 
            labelFormat="D" 
            height={30}
            intervalRenderer={({ getIntervalProps, intervalContext }) => {
                const { key, ...props } = getIntervalProps();
                return (
                    <div 
                      key={key} 
                      {...props} 
                      style={{
                        ...props.style,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#475569',
                        background: '#f8fafc',
                        borderLeft: '1px solid #e2e8f0'
                      }}
                    >
                        {intervalContext.intervalText}
                    </div>
                );
            }}
          />
        </TimelineHeaders>
      </Timeline>
      
      <div className="d-flex gap-4 justify-content-end p-2 bg-light border-top small">
          <div className="d-flex align-items-center gap-2"><div style={{width: 15, height: 15, background: '#f59e0b', borderRadius: 4}}></div><span>Asignada</span></div>
          <div className="d-flex align-items-center gap-2"><div style={{width: 15, height: 15, background: '#10b981', borderRadius: 4}}></div><span>Ejecución / Aprobada</span></div>
          <div className="d-flex align-items-center gap-2"><div style={{width: 15, height: 15, background: '#6b7280', borderRadius: 4}}></div><span>Pagada / Histórico</span></div>
      </div>
    </div>
  );
};

export default TimelineView;