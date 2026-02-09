import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Registrar fuente estándar (opcional, usaremos Helvetica que es nativa y segura)
// Si quisieras fuentes custom, se registran aquí.

// --- PALETA DE COLORES PROFESIONAL ---
const COLORS = {
  primary: '#2c3e50',    // Azul oscuro corporativo
  secondary: '#546e7a',  // Gris azulado para subtítulos
  accent: '#e74c3c',     // Rojo para descuentos/alertas
  headerBg: '#f8f9fa',   // Fondo gris muy suave para cabeceras
  tableHeader: '#eceff1',// Fondo para cabecera de tabla
  border: '#cfd8dc'      // Gris claro para líneas
};

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#333', lineHeight: 1.4 },
  
    // ENCABEZADO (Más compacto)
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: COLORS.primary, paddingBottom: 8 },
    companyInfo: { flexDirection: 'column' },
    companyName: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, textTransform: 'uppercase' },
    companyDetails: { fontSize: 7, color: COLORS.secondary, marginTop: 1 },
  
    docInfo: { alignItems: 'flex-end' },
    docTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary, textTransform: 'uppercase' },
    docCode: { fontSize: 9, marginTop: 2, color: '#555' },
  
    // BLOQUE DE DATOS (Más pequeño y refinado)
    infoGrid: { flexDirection: 'row', marginBottom: 15, backgroundColor: COLORS.headerBg, padding: 8, borderRadius: 4 },
    infoCol: { width: '50%' },
    label: { fontSize: 6, color: COLORS.secondary, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 1, letterSpacing: 0.5 },
    value: { fontSize: 9, marginBottom: 6, fontWeight: 'bold', color: '#222' },

    // TABLA (Compacta)
    table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: COLORS.border, marginBottom: 15 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.tableHeader, borderBottomWidth: 1, borderBottomColor: COLORS.border, height: 20, alignItems: 'center' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', height: 20, alignItems: 'center' },
  
    // ... Resto de estilos de columnas igual (colDesc, colRef, etc) ...
    colDesc: { width: '45%', paddingLeft: 8 },
    colRef: { width: '15%', paddingLeft: 4 },
    colQty: { width: '10%', textAlign: 'center' },
    colPrice: { width: '15%', textAlign: 'right', paddingRight: 8 },
    colTotal: { width: '15%', textAlign: 'right', paddingRight: 8 },
  
    textHeader: { fontSize: 7, fontWeight: 'bold', color: COLORS.primary },
    textRow: { fontSize: 8, color: '#444' },

    // TOTALES
    summarySection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 },
    summaryBox: { width: '40%' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    summaryLabel: { fontSize: 8, color: COLORS.secondary },
    summaryValue: { fontSize: 8, fontWeight: 'bold', textAlign: 'right' },
  
    discountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
    discountLabel: { fontSize: 7, color: COLORS.accent, fontStyle: 'italic' },
    discountValue: { fontSize: 7, color: COLORS.accent, textAlign: 'right' },
    discountDesc: { fontSize: 6, color: COLORS.secondary, marginTop: 0 },

    totalFinalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 1.5, borderTopColor: COLORS.primary, paddingTop: 4 },
    totalLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.primary },
    totalValue: { fontSize: 10, fontWeight: 'bold', color: COLORS.primary, textAlign: 'right' },

    // FIRMAS
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40 },
    signSection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    signBox: { width: '35%', borderTopWidth: 1, borderTopColor: '#999', paddingTop: 4, alignItems: 'center' },
    signText: { fontSize: 7, fontWeight: 'bold', color: '#555' },
    signSub: { fontSize: 6, color: '#999', marginTop: 1 }
});

const DocumentoEP = ({ epData, tareas, proyectoInfo, descuentos = [] }) => {
  // 1. Expandir items de tareas (si tiene items, mostrar esos; sino, mostrar la cabecera)
  const itemsExpandidos = [];
  tareas.forEach(tarea => {
    if (tarea.items && tarea.items.length > 0) {
      tarea.items.forEach(item => {
        itemsExpandidos.push({
          nombre: item.actividad?.nombre || item.sub_actividad?.nombre || 'Actividad',
          zona: tarea.zona?.nombre || 'S/I',
          tramo: tarea.tramo?.nombre || '',
          cantidad: item.cantidad_real || item.cantidad_asignada || 0,
          precio: item.precio_costo_unitario || 0,
          tareaId: tarea.id
        });
      });
    } else {
      // Fallback: mostrar tarea como un solo item
      itemsExpandidos.push({
        nombre: tarea.actividad?.nombre || tarea.sub_actividad?.nombre || 'Item sin nombre',
        zona: tarea.zona?.nombre || 'S/I',
        tramo: tarea.tramo?.nombre || '',
        cantidad: tarea.cantidad_real || tarea.cantidad_asignada || 0,
        precio: tarea.precio_costo_unitario || 0,
        tareaId: tarea.id
      });
    }
  });

  // 2. Cálculos basados en items expandidos
  const fechaEmision = format(new Date(), 'dd MMMM yyyy', { locale: es });
  const subtotal = itemsExpandidos.reduce((acc, item) => acc + (Number(item.cantidad) * Number(item.precio)), 0);
  
  // Sumar descuentos (asumiendo que vienen como objetos {nombre, monto})
  const totalDescuentos = descuentos.reduce((acc, d) => acc + Number(d.monto), 0);
  const totalPagar = subtotal - totalDescuentos;

  // Formateador de moneda
  const currency = (num) => `$ ${Number(num).toLocaleString('es-CL')}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* --- HEADER --- */}
        <View style={styles.headerContainer}>
            <View style={styles.companyInfo}>
                {/* AQUÍ PUEDES PONER TU LOGO CON <Image src="url" /> */}
                <Text style={styles.companyName}>Somyl  S.A.</Text>
                <Text style={{height: 6}} />

                <Text style={styles.companyDetails}>Rut: 76.002.581-K</Text>
                <Text style={styles.companyDetails}>PUERTA ORIENTE 361 OF 311 B TORRE B COLINA</Text>
                <Text style={styles.companyDetails}>lmedina@somyl.com, cynthia.miranda@somyl.com</Text>
            </View>
            <View style={styles.docInfo}>
                <Text style={styles.docTitle}>ESTADO DE PAGO</Text>
                <Text style={styles.docCode}>{epData?.codigo || 'BORRADOR'}</Text>
                <Text style={{fontSize: 9, color: '#777', marginTop: 5}}>Fecha Emisión: {fechaEmision}</Text>
            </View>
        </View>

        {/* --- INFORMACIÓN DEL PROYECTO Y PROVEEDOR --- */}
        <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
                <Text style={styles.label}>PROYECTO</Text>
                <Text style={styles.value}>{proyectoInfo?.nombre || proyectoInfo?.proyecto || proyectoInfo?.proyecto_solo || 'General'}</Text>
            </View>
            <View style={styles.infoCol}>
                <Text style={styles.label}>SUBCONTRATISTA (BENEFICIARIO)</Text>
                <Text style={styles.value}>{epData?.proveedor?.nombre || '...'}</Text>
                <Text style={styles.label}>CORREO</Text>
                <Text style={styles.value}>{epData?.proveedor?.email || epData?.proveedor?.correo || epData?.proveedor?.contacto_email || '-'}</Text>
                <Text style={styles.label}>TELÉFONO</Text>
                <Text style={styles.value}>{epData?.proveedor?.phone || epData?.proveedor?.telefono || epData?.proveedor?.fono || '-'}</Text>
            </View>
        </View>

        {/* --- TABLA DE DETALLES --- */}
        <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
                <Text style={[styles.colDesc, styles.textHeader]}>DESCRIPCIÓN ACTIVIDAD</Text>
                <Text style={[styles.colRef, styles.textHeader]}>UBICACIÓN</Text>
                <Text style={[styles.colQty, styles.textHeader]}>CANT.</Text>
                <Text style={[styles.colPrice, styles.textHeader]}>P. UNIT</Text>
                <Text style={[styles.colTotal, styles.textHeader]}>TOTAL</Text>
            </View>

            {itemsExpandidos.map((item, index) => (
                <View style={styles.tableRow} key={index}>
                    <Text style={[styles.colDesc, styles.textRow]}>
                        {item.nombre}
                    </Text>
                    <Text style={[styles.colRef, styles.textRow]}>
                        {item.zona} {item.tramo ? `- ${item.tramo}` : ''}
                    </Text>
                    <Text style={[styles.colQty, styles.textRow]}>
                        {item.cantidad}
                    </Text>
                    <Text style={[styles.colPrice, styles.textRow]}>
                        {currency(item.precio)}
                    </Text>
                    <Text style={[styles.colTotal, styles.textRow, {fontWeight: 'bold'}]}>
                        {currency(item.cantidad * item.precio)}
                    </Text>
                </View>
            ))}
        </View>

        {/* --- TOTALES Y DESCUENTOS --- */}
        <View style={styles.summarySection}>
            <View style={styles.summaryBox}>
                
                {/* SUBTOTAL */}
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>SUBTOTAL TRABAJOS:</Text>
                    <Text style={styles.summaryValue}>{currency(subtotal)}</Text>
                </View>

                {/* LISTA DE DESCUENTOS */}
                {descuentos.length > 0 && (
                    <View style={{marginVertical: 4, paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#eee'}}>
                         {descuentos.map((d, i) => (
                             <View key={i} style={{marginBottom: 6}}>
                                 <View style={styles.discountRow}>
                                     <Text style={styles.discountLabel}>(-) {d.nombre}</Text>
                                     <Text style={styles.discountValue}>- {currency(d.monto)}</Text>
                                 </View>
                                 {d.descripcion && (
                                     <Text style={styles.discountDesc}>{d.descripcion}</Text>
                                 )}
                             </View>
                         ))}
                    </View>
                )}

                {/* TOTAL A PAGAR */}
                <View style={styles.totalFinalRow}>
                    <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
                    <Text style={styles.totalValue}>{currency(totalPagar)}</Text>
                </View>

            </View>
        </View>

        {/* --- PIE DE PÁGINA (FIRMAS) --- */}
        <View style={styles.footer}>
            <View style={styles.signSection}>
                <View style={styles.signBox}>
                    <Text style={styles.signText}>ADMINISTRADOR DE OBRA</Text>
                    <Text style={styles.signSub}>Aprobación Técnica</Text>
                </View>
                <View style={styles.signBox}>
                    <Text style={styles.signText}>{epData?.proveedor?.nombre?.toUpperCase()}</Text>
                    <Text style={styles.signSub}>Recibí Conforme</Text>
                </View>
            </View>
            <Text style={{textAlign: 'center', fontSize: 8, color: '#aaa', marginTop: 30}}>
                Generado automáticamente por Sistema de produccion Somyl S.A.
            </Text>
        </View>

      </Page>
    </Document>
  );
};

export default DocumentoEP;