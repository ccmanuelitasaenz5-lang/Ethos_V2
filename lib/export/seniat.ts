import { format } from 'date-fns'

/**
 * Utility to generate SENIAT XML/TXT formats for ISLR Retentions
 */

interface RetentionDetail {
    rifRetained: string
    invoiceNumber: string
    controlNumber: string
    transactionDate: Date // Fecha de Operacion
    code: string // Concept code e.g. "001"
    baseAmount: number
    retentionPercent: number
}

// Helper to format numbers for XML (1234.56 -> 1234.56)
const fmtNum = (num: number) => num.toFixed(2)

// Helper to format date (dd/mm/yyyy for visual, YYYY-MM-DD for standard)
// SENIAT usually expects YYYYMM or DD/MM/YYYY depending on specific file.
// For XML standard:
const fmtDate = (d: Date) => format(d, 'dd/MM/yyyy')

// Escapa caracteres especiales de XML. Sin esto, un RIF, número de factura o
// nombre de proveedor que contenga '&', '<', '>', comillas, etc. genera un XML
// mal formado que el importador de SENIAT rechaza directamente.
const escapeXml = (value: string): string =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

export function generateISLRXml(data: any[], rifAgent: string, period: string) {
    // Structure based on common SENIAT ISLR XML schema
    // <RelacionRetencionesISLR RifAgente="J000000000" Periodo="202401">
    //   <DetalleRetencion>
    //     <RifRetenido>J123456789</RifRetenido>
    //     <NumeroFactura>001</NumeroFactura>
    //     <NumeroControl>00-00001</NumeroControl>
    //     <FechaOperacion>01/01/2024</FechaOperacion>
    //     <CodigoConcepto>001</CodigoConcepto>
    //     <MontoOperacion>100.00</MontoOperacion>
    //     <PorcentajeRetencion>75.00</PorcentajeRetencion>
    //   </DetalleRetencion>
    // </RelacionRetencionesISLR>

    // NOTA: se declara UTF-8 (no ISO-8859-1 como antes) porque el archivo se
    // genera con `new Blob([xmlContent])` en components/reportes/FiscalReports.tsx,
    // y la API Blob siempre codifica strings de JS como UTF-8. Declarar
    // ISO-8859-1 sobre bytes UTF-8 reales causaba que nombres/RIF con tildes o
    // ñ se leyeran mal (o el archivo fuera rechazado) al importarlo en SENIAT.
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    xml += `<RelacionRetencionesISLR RifAgente="${escapeXml(rifAgent)}" Periodo="${escapeXml(period)}">\n`

    data.forEach(item => {
        // Safe defaults
        const rifRetained = item.supplier_rif || 'J000000000'
        const invoiceNumber = item.invoice_number || '0'
        const controlNumber = item.control_number || '0'
        const date = new Date(item.date)
        const code = item.islr_concept_code || '001' // Would need new field in Expense or logic to map
        const base = item.subtotal || 0
        const percent = item.retention_islr && base > 0 ? (item.retention_islr / base * 100) : 0

        xml += `\t<DetalleRetencion>\n`
        xml += `\t\t<RifRetenido>${escapeXml(rifRetained)}</RifRetenido>\n`
        xml += `\t\t<NumeroFactura>${escapeXml(invoiceNumber)}</NumeroFactura>\n`
        xml += `\t\t<NumeroControl>${escapeXml(controlNumber)}</NumeroControl>\n`
        xml += `\t\t<FechaOperacion>${fmtDate(date)}</FechaOperacion>\n`
        xml += `\t\t<CodigoConcepto>${escapeXml(code)}</CodigoConcepto>\n`
        xml += `\t\t<MontoOperacion>${fmtNum(base)}</MontoOperacion>\n`
        xml += `\t\t<PorcentajeRetencion>${fmtNum(percent)}</PorcentajeRetencion>\n`
        xml += `\t</DetalleRetencion>\n`
    })

    xml += `</RelacionRetencionesISLR>`
    return xml
}

export function generateIVAFile(data: any[]) {
    // TBD for future. Usually a TXT file with specific columns separated by tabs.
    return ""
}
