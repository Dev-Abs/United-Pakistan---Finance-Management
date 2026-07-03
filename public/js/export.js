import { utils } from './utils.js';

async function fetchWithAuth(url) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Export failed');
  }
  return res;
}

async function downloadBlob(url, filename) {
  const res = await fetchWithAuth(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export function setupExportListeners(appInstance) {
  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    if (!appInstance.state.currentMonth) return;
    const monthEnc = encodeURIComponent(appInstance.state.currentMonth);
    const filename = 'Finance_Report_' + appInstance.state.currentMonth.replace(/\s+/g, '_') + '.csv';
    try {
      utils.showLoader();
      await downloadBlob('/api/export/csv?month=' + monthEnc, filename);
      utils.showToast('CSV exported');
    } catch (error) {
      utils.showToast(error.message || 'Export failed', 'error');
    } finally {
      utils.hideLoader();
    }
  });

  document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
    if (!appInstance.state.currentMonth) return;
    const monthEnc = encodeURIComponent(appInstance.state.currentMonth);
    const filename = 'Finance_Report_' + appInstance.state.currentMonth.replace(/\s+/g, '_') + '.xlsx';
    try {
      utils.showLoader();
      await downloadBlob('/api/export/excel?month=' + monthEnc, filename);
      utils.showToast('Excel exported');
    } catch (error) {
      utils.showToast(error.message || 'Export failed', 'error');
    } finally {
      utils.hideLoader();
    }
  });

  document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
    if (!appInstance.state.currentMonth) return;

    utils.showLoader();
    try {
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
      }

      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const json = await res.json();
      if (!json.success) throw new Error('Failed to fetch data');

      const members = json.data;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Finance Report - ' + appInstance.state.currentMonth, 14, 22);

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
        headStyles: { fillColor: [26, 86, 219] }
      });

      doc.save('Finance_Report_' + appInstance.state.currentMonth.replace(/\s+/g, '_') + '.pdf');
      utils.showToast('PDF exported');
    } catch (error) {
      console.error('PDF Export Error:', error);
      utils.showToast(error.message || 'Failed to export PDF', 'error');
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
