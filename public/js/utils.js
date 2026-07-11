export const utils = {
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';
        
        toast.innerHTML = `<span class="icon">${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    showLoader() {
        // No-op: skeletons replace the full-screen loader
    },

    hideLoader() {
        // No-op: skeletons replace the full-screen loader
    },
    
    generateWhatsAppLink(phone, message) {
        const text = encodeURIComponent(message || '');
        if (!phone) return `https://wa.me/?text=${text}`;
        // Clean phone number (remove non-digits)
        let cleaned = phone.toString().replace(/\D/g, '');
        if (cleaned.startsWith('0092')) {
            cleaned = cleaned.substring(2);
        }
        // Default to Pakistan code if starts with 0
        if (cleaned.startsWith('0')) {
            cleaned = '92' + cleaned.substring(1);
        } else if (cleaned.length === 10 && cleaned.startsWith('3')) {
            cleaned = '92' + cleaned;
        }
        return `https://wa.me/${cleaned}?text=${text}`;
    }
};
