import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 10, color: '#7f8c8d', marginTop: 4 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', backgroundColor: '#f0f4f8', padding: 4, marginBottom: 6, color: '#2c3e50' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 100, fontWeight: 'bold', color: '#555' },
  value: { flex: 1 },
  table: { display: "table", width: "auto", borderStyle: "solid", borderWidth: 1, borderColor: '#bfbfbf', borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { margin: "auto", flexDirection: "row" },
  tableCol: { width: "70%", borderStyle: "solid", borderWidth: 1, borderColor: '#bfbfbf', borderLeftWidth: 0, borderTopWidth: 0 },
  tableColSmall: { width: "15%", borderStyle: "solid", borderWidth: 1, borderColor: '#bfbfbf', borderLeftWidth: 0, borderTopWidth: 0 },
  tableCell: { margin: 4, fontSize: 9 },
  tableHeader: { backgroundColor: '#e0e0e0', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: '#aaa', fontSize: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }
});

const DocumentoOT = ({ tarea, items, proyecto }) => {
  const fecha = tarea.fecha_asignacion ? format(new Date(tarea.fecha_asignacion), 'dd/MM/yyyy') : '---';
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.header}>
            <View>
                <Text style={styles.title}>ORDEN DE TRABAJO</Text>
                <Text style={styles.subtitle}>OT #{tarea.id} - {proyecto?.nombre}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
                <Text style={{fontSize: 20, fontWeight: 'bold', color: '#ccc'}}>SOMYL</Text>
                <Text>Fecha: {fecha}</Text>
            </View>
        </View>

        {/* DATOS GENERALES */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>INFORMACIÓN GENERAL</Text>
            <View style={styles.row}><Text style={styles.label}>Contratista:</Text><Text style={styles.value}>{tarea.proveedor?.nombre || '---'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>RUT:</Text><Text style={styles.value}>{tarea.proveedor?.rut || '---'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Zona:</Text><Text style={styles.value}>{tarea.zona?.nombre || '---'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Tramo:</Text><Text style={styles.value}>{tarea.tramo?.nombre || '---'}</Text></View>
            {tarea.punta_inicio && <View style={styles.row}><Text style={styles.label}>Puntas:</Text><Text style={styles.value}>{tarea.punta_inicio} a {tarea.punta_final}</Text></View>}
        </View>

        {/* TABLA DE ACTIVIDADES */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVIDADES A REALIZAR</Text>
            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <View style={styles.tableCol}><Text style={[styles.tableCell, {fontWeight:'bold'}]}>Descripción Actividad</Text></View>
                    <View style={styles.tableColSmall}><Text style={[styles.tableCell, {textAlign:'center', fontWeight:'bold'}]}>Unidad</Text></View>
                    <View style={styles.tableColSmall}><Text style={[styles.tableCell, {textAlign:'center', fontWeight:'bold'}]}>Cant.</Text></View>
                </View>
                {items.map((item, i) => (
                    <View style={styles.tableRow} key={i}>
                        <View style={styles.tableCol}><Text style={styles.tableCell}>{item.label}</Text></View>
                        <View style={styles.tableColSmall}><Text style={[styles.tableCell, {textAlign:'center'}]}>{item.data?.unidad || 'UN'}</Text></View>
                        <View style={styles.tableColSmall}><Text style={[styles.tableCell, {textAlign:'center'}]}>{item.cantidad_asignada}</Text></View>
                    </View>
                ))}
            </View>
        </View>

        {/* COORDENADAS Y LINKS */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>REFERENCIA</Text>
            {tarea.geo_lat && (
                <View style={styles.row}>
                    <Text style={styles.label}>Coordenadas:</Text>
                    <Link src={`https://maps.google.com/?q=${tarea.geo_lat},${tarea.geo_lon}`} style={{color: 'blue', fontSize: 9}}>
                        {tarea.geo_lat}, {tarea.geo_lon} (Ver en Mapa)
                    </Link>
                </View>
            )}
            {tarea.archivo_plano_url && (
                <View style={styles.row}>
                    <Text style={styles.label}>Plano Adjunto:</Text>
                    <Link src={tarea.archivo_plano_url} style={{color: 'blue', fontSize: 9}}>
                        Descargar Documento
                    </Link>
                </View>
            )}
        </View>

        <Text style={styles.footer}>Generado automáticamente por Sistema de Gestión SOMYL - {new Date().toLocaleString()}</Text>
      </Page>
    </Document>
  );
};

export default DocumentoOT;