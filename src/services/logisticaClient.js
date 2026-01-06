// Leer configuración desde .env
const BASE_URL = import.meta.env.VITE_LOGISTICA_URL;
const API_KEY = import.meta.env.VITE_LOGISTICA_KEY;

// Verificación de seguridad para el desarrollador
if (!BASE_URL || !API_KEY) {
    console.error("🚨 Faltan las credenciales de LOGÍSTICA en el archivo .env");
}

export const logisticaService = {
    async getEntregasProveedor(proveedorId) {
        if (!proveedorId) return [];

        console.log("📡 Consultando Logística vía FETCH directo...");

        try {
            // 1. BUSCAR DOCUMENTOS (Cabeceras)
            // Construimos la URL manualmente para evitar problemas de librería
            const urlDocs = `${BASE_URL}/rest/v1/logis_outbound_documents?select=id&is_subcontract=eq.true&provider_id=eq.${proveedorId}`;
            
            const responseDocs = await fetch(urlDocs, {
                method: 'GET',
                headers: {
                    'apikey': API_KEY,
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!responseDocs.ok) {
                const errorData = await responseDocs.json();
                console.error("❌ Error API Docs:", errorData);
                throw new Error(errorData.message || "Error al conectar con Logística");
            }

            const docs = await responseDocs.json();

            if (!docs || docs.length === 0) {
                console.warn("⚠️ No se encontraron despachos para este proveedor.");
                return [];
            }

            // 2. BUSCAR ITEMS (Detalles)
            // Extraemos los IDs de las guías encontradas
            const docIds = docs.map(d => d.id).join(','); // "8,9,10"
            
            // Hacemos la consulta de items filtrando por esos IDs
            // Sintaxis de Supabase REST: outbound_document_id=in.(id1,id2,id3)
            const urlItems = `${BASE_URL}/rest/v1/logis_outbound_items?select=quantity,product:products(code,name,unit)&outbound_document_id=in.(${docIds})`;

            const responseItems = await fetch(urlItems, {
                method: 'GET',
                headers: {
                    'apikey': API_KEY,
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!responseItems.ok) {
                console.error("❌ Error API Items");
                return [];
            }

            const items = await responseItems.json();

            // 3. FORMATEAR RESULTADO
            const resultado = items.map(i => ({
                codigo: i.product?.code,
                nombre: i.product?.name,
                unidad: i.product?.unit || 'UN',
                cantidad: Number(i.quantity)
            }));

            console.log("✅ Materiales obtenidos:", resultado);
            return resultado;

        } catch (error) {
            console.error("🔥 Error Fatal FETCH:", error);
            alert("Error de conexión con Logística: " + error.message);
            return [];
        }
    }
};

// Exportamos un objeto vacío para mantener compatibilidad si algo importa 'supabaseLogistica'
export const supabaseLogistica = {};