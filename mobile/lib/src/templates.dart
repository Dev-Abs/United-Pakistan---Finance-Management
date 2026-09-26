import 'finance_store.dart';

String applyTemplate(String source, Map<String, Object?> values) =>
    source.replaceAllMapped(RegExp(r'\{([a-z_]+)\}'),
        (match) => values[match.group(1)]?.toString() ?? match.group(0)!);

Map<String, Object?> templateValues(
  FinanceStore store, [
  Map<String, dynamic>? member,
  Map<String, Object?> extra = const {},
]) {
  final now = DateTime.now();
  final paidCount = store.members
      .where((m) => m['Payment Status']?.toString() == 'Paid')
      .length;
  final partialCount = store.members
      .where((m) => m['Payment Status']?.toString() == 'Partially Paid')
      .length;
  final pendingCount = store.members.length - paidCount - partialCount;
  final isPartial = member?['Payment Status']?.toString() == 'Partially Paid';
  return {
    'member_name': member?['Name'] ?? '',
    'date': _dateLabel(now),
    'month': store.month ?? '',
    'report_period': store.month ?? '',
    'amount': _money(member?['Amount Paid']),
    'balance': _money(member?['Remaining Balance']),
    'total_payable': _money(member?['Total Payable']),
    'monthly_fund': _money(member?['Monthly Fund']),
    'previous_balance': _money(member?['Previous Balance']),
    'member_category': member?['Member Category'] ?? 'Fellow Member (FM)',
    'reminder_opening': isPartial
        ? 'Thank you for the partial payment. This is a gentle reminder for the remaining balance.'
        : 'This is a gentle reminder regarding your monthly fund.',
    'organization_name': store.settings['ORG_NAME'] ?? 'United Pakistan',
    'sector_name': store.settings['SECTOR_NAME'] ?? '',
    'secretary_name': store.settings['SECRETARY_NAME'] ?? '',
    'easypaisa_number': store.settings['EASYPAISA_NUMBER'] ?? '',
    'account_title': store.settings['ACCOUNT_TITLE'] ?? '',
    'fund_amount': _money(store.contributions
        .fold<double>(0, (sum, item) => sum + number(item['Amount Paid']))),
    'special_fund_name':
        store.settings['SPECIAL_FUND_CAMPAIGN_NAME'] ?? 'Special Fund',
    'campaign_name':
        store.settings['SPECIAL_FUND_CAMPAIGN_NAME'] ?? 'Special Fund',
    'event_timing': store.settings['SPECIAL_FUND_EVENT_TIMING'] ?? '',
    'event_venue': store.settings['SPECIAL_FUND_EVENT_VENUE'] ?? '',
    'jp_minimum': _money(store.settings['SPECIAL_FUND_JP_MINIMUM']),
    'sc_minimum': _money(store.settings['SPECIAL_FUND_SC_MINIMUM']),
    'fm_minimum': _money(store.settings['SPECIAL_FUND_FM_MINIMUM']),
    'collected': _money(store.collected),
    'outstanding': _money(store.outstanding),
    'expenses': _money(store.spent),
    'cash_balance': _money(store.balance),
    'total_members': store.members.length,
    'paid_count': paidCount,
    'partial_count': partialCount,
    'pending_count': pendingCount,
    'total_due': _money(store.due),
    'ai_content': '',
    ...extra,
  };
}

String _money(Object? value) {
  final amount = number(value).round();
  return 'Rs ${amount.toString().replaceAllMapped(RegExp(r'(?=(\d{3})+(?!\d))'), (_) => ',')}';
}

String _dateLabel(DateTime date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}

const templateVariableNames = <String>[
  'member_name',
  'date',
  'month',
  'report_period',
  'amount',
  'balance',
  'total_payable',
  'monthly_fund',
  'previous_balance',
  'member_category',
  'reminder_opening',
  'organization_name',
  'sector_name',
  'secretary_name',
  'easypaisa_number',
  'account_title',
  'fund_amount',
  'special_fund_name',
  'campaign_name',
  'event_timing',
  'event_venue',
  'jp_minimum',
  'sc_minimum',
  'fm_minimum',
  'collected',
  'outstanding',
  'expenses',
  'cash_balance',
  'total_members',
  'paid_count',
  'partial_count',
  'pending_count',
  'total_due',
  'ai_content',
];

const defaultTemplates = <String, String>{
  'WHATSAPP_MEMBER_TEMPLATE':
      '*{organization_name} - {sector_name}*\n\nAssalamu Alaikum {member_name} sb!\n\n{reminder_opening}\n\nFund Details:\n- Member Category: {member_category}\n- Monthly Fund: {monthly_fund}\n- Previous Balance: {previous_balance}\n- Total Payable: {total_payable}\n- Amount Paid: {amount}\n- Remaining Due: {balance}\n\nPayment Details:\nEasypaisa: {easypaisa_number}\nAccount Title: {account_title}\n\nKindly transfer the remaining amount and share the receipt.\n\nThank you.\n{secretary_name}\nSecretary Finance',
  'WHATSAPP_REPORT_TEMPLATE':
      '*{organization_name} - Sector Finance Report*\n*{report_period}*\n\n*Members Summary*\n- Total Members: {total_members}\n- Fully Paid: {paid_count}\n- Partially Paid: {partial_count}\n- Pending: {pending_count}\n\n*Collection Summary*\n- Total Due: {total_due}\n- Total Collected: {collected}\n- Total Remaining: {outstanding}\n\n*Fund & Expenses*\n- Expenses Made: {expenses}\n- Remaining After Expenses: {cash_balance}\n\nPlease clear remaining dues at the earliest.\nThank you.',
  'WHATSAPP_MONTHLY_REPORT_TEMPLATE':
      '*Monthly Finance Report — {month}*\nDate: {date}\n\nCollected: {collected}\nOutstanding: {outstanding}\nExpenses: {expenses}\nNet cash: {cash_balance}',
  'SPECIAL_FUND_REPORT_TEMPLATE':
      '*{special_fund_name} Report*\nReport period: {report_period}\nDate: {date}\n\nTotal collected: {fund_amount}',
  'AI_REPORT_TEMPLATE':
      '*{organization_name} — AI Finance Narrative*\n{report_period}\n\n{ai_content}\n\nVerified totals: collected {collected}, outstanding {outstanding}, expenses {expenses}.',
  'AI_MESSAGE_TEMPLATE':
      'Assalamu Alaikum {member_name} sb,\n\n{ai_content}\n\nRemaining balance: {balance}\n\n{organization_name}\n{secretary_name}',
};

String template(FinanceStore store, String key) =>
    store.settings[key]?.toString().trim().isNotEmpty == true
        ? store.settings[key].toString()
        : defaultTemplates[key] ?? '';
