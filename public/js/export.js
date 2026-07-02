import { utils } from './utils.js';

export function setupExportListeners(appInstance) {
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        if (!appInstance.state.currentMonth) return;
        window.location.href = `/api/export/csv?month=${encodeURIComponent(appInstance.state.currentMonth)}`;
    });

    document.getElementById('btn-export-excel')?.addEventListener('click', () => {
        if (!appInstance.state.currentMonth) return;
        window.location.href = `/api/export/excel?month=${encodeURIComponent(appInstance.state.currentMonth)}`;
    });

    document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
        if (!appInstance.state.currentMonth) return;
        
        utils.showLoader();
        try {
            // Check if jsPDF is available
            if (!window.jspdf) {
                // dynamically load jsPDF and autoTable if not present
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
            }
            
            // Fetch data
            const res = await fetch(`/api/members?month=${encodeURIComponent(appInstance.state.currentMonth)}`);
            const json = await res.json();
            if (!json.success) throw new Error('Failed to fetch data');
            
            const members = json.data;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(18);
            doc.text(`Finance Report - ${appInstance.state.currentMonth}`, 14, 22);
            
            const tableData = members.map(m => [
                m['Name'] || '',
                m['Phone Number'] || '',
                utils.formatCurrency(m['Total Payable']),
                utils.formatCurrency(m['Amount Paid']),
                utils.formatCurrency(m['Remaining Balance']),
                m['Payment Status'] || ''
            ]);
            
            doc.autoTable({
                startY: 30,
                head: [['Name', 'Phone', 'Total Due', 'Paid', 'Remaining', 'Status']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [26, 86, 219] } // primary color
            });
            
            doc.save(`Finance_Report_${appInstance.state.currentMonth.replace(/\s+/g, '_')}.pdf`);
            utils.showToast('PDF Exported successfully');
        } catch (error) {
            console.error('PDF Export Error:', error);
            utils.showToast('Failed to export PDF', 'error');
        } finally {
            utils.hideLoader();
        }
    });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
