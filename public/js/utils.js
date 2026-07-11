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
    
    normalizeWhatsAppPhone(phone) {
        if (!phone) return '';
        let cleaned = phone.toString().replace(/\D/g, '');
        if (cleaned.startsWith('0092')) {
            cleaned = cleaned.substring(2);
        }
        if (cleaned.startsWith('0')) {
            cleaned = '92' + cleaned.substring(1);
        } else if (cleaned.length === 10 && cleaned.startsWith('3')) {
            cleaned = '92' + cleaned;
        }
        return cleaned;
    },

    generateWhatsAppLink(phone, message) {
        const text = encodeURIComponent(message || '');
        const cleaned = this.normalizeWhatsAppPhone(phone);
        if (!cleaned) return `https://wa.me/?text=${text}`;
        return `https://wa.me/${cleaned}?text=${text}`;
    },

    generateWhatsAppAppLink(phone, message) {
        const text = encodeURIComponent(message || '');
        const cleaned = this.normalizeWhatsAppPhone(phone);
        if (!cleaned) return `whatsapp://send?text=${text}`;
        return `whatsapp://send?phone=${cleaned}&text=${text}`;
    }
};
