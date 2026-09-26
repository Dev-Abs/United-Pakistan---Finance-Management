import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'ai_assistant.dart';
import 'finance_store.dart';
import 'templates.dart';
import 'theme.dart';

export 'templates.dart';

String _money(Object? value) {
  final amount = number(value).round();
  return 'Rs ${amount.toString().replaceAllMapped(RegExp(r'(?=(\d{3})+(?!\d))'), (_) => ',')}';
}

String _dateLabel(Object? value) {
  if (value == null || value.toString().isEmpty) return 'No date';
  final date = DateTime.tryParse(value.toString());
  if (date == null) return value.toString();
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

String _phone(Object? raw) {
  var digits = raw?.toString().replaceAll(RegExp(r'\D'), '') ?? '';
  if (digits.startsWith('0')) digits = '92${digits.substring(1)}';
  if (digits.length == 10 && digits.startsWith('3')) digits = '92$digits';
  return digits.length >= 11 ? digits : '';
}

Future<bool> openWhatsApp(BuildContext context, String message,
    {Object? phone}) async {
  final target = _phone(phone);
  final uri = Uri.parse(
      'https://wa.me/${target.isEmpty ? '' : target}?text=${Uri.encodeComponent(message)}');
  if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return true;
  if (context.mounted) {
    await Clipboard.setData(ClipboardData(text: message));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('WhatsApp could not open. Message copied instead.')));
  }
  return false;
}

Future<void> showMemberExperience(BuildContext context, FinanceStore store,
    Map<String, dynamic> member, bool readOnly,
    {VoidCallback? onPayment}) async {
  await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => MemberDetailScreen(
          store: store,
          member: member,
          readOnly: readOnly,
          onPayment: onPayment)));
}

class MemberDetailScreen extends StatefulWidget {
  const MemberDetailScreen(
      {super.key,
      required this.store,
      required this.member,
      required this.readOnly,
      this.onPayment});
  final FinanceStore store;
  final Map<String, dynamic> member;
  final bool readOnly;
  final VoidCallback? onPayment;
  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  late Future<List<List<Map<String, dynamic>>>> future;
  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<List<List<Map<String, dynamic>>>> _load() async => Future.wait([
        widget.store.history(widget.member),
        widget.store.memberFollowUps(widget.member)
      ]);

  Future<void> _message() async {
    if (_phone(widget.member['Phone Number']).isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Add a valid member phone number first.')));
      return;
    }
    final message = applyTemplate(
        template(widget.store, 'WHATSAPP_MEMBER_TEMPLATE'),
        templateValues(widget.store, widget.member));
    final opened = await openWhatsApp(context, message,
        phone: widget.member['Phone Number']);
    if (opened && !widget.readOnly) {
      try {
        await widget.store.addFollowUp(widget.member, {
          'Event Type': 'Reminder Sent',
          'Reply Status': 'No Reply',
          'Reason / Reply': '',
          'Notes': 'WhatsApp reminder opened from mobile app'
        });
      } catch (_) {
        if (mounted)
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text(
                  'WhatsApp opened, but reminder history was not saved.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Member profile'), actions: [
        if (!widget.readOnly)
          PopupMenuButton<String>(
              onSelected: (value) async {
                if (value == 'edit')
                  await showMemberEditor(context, widget.store,
                      member: widget.member);
                if (value == 'followup')
                  await showFollowUpEditor(
                      context, widget.store, widget.member);
                if (value == 'delete') {
                  final yes = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                              title: const Text('Delete member?'),
                              content: const Text(
                                  'This removes the member from the selected month.'),
                              actions: [
                                TextButton(
                                    onPressed: () => Navigator.pop(c, false),
                                    child: const Text('Cancel')),
                                FilledButton(
                                    onPressed: () => Navigator.pop(c, true),
                                    child: const Text('Delete'))
                              ]));
                  if (yes == true) {
                    await widget.store.deleteMember(
                        int.parse(widget.member['_rowId'].toString()));
                    if (context.mounted) Navigator.pop(context);
                  }
                }
              },
              itemBuilder: (_) => const [
                    PopupMenuItem(value: 'edit', child: Text('Edit member')),
                    PopupMenuItem(
                        value: 'followup', child: Text('Log follow-up')),
                    PopupMenuItem(value: 'delete', child: Text('Delete member'))
                  ])
      ]),
      body: FutureBuilder<List<List<Map<String, dynamic>>>>(
          future: future,
          builder: (context, snapshot) {
            final history = snapshot.data?.first ?? const [];
            final followUps = snapshot.data?.last ?? const [];
            return RefreshIndicator(
                onRefresh: () async {
                  setState(() => future = _load());
                  await future;
                },
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  Text(widget.member['Name']?.toString() ?? 'Member',
                      style: Theme.of(context).textTheme.headlineMedium),
                  Text(
                      '${widget.member['Member Category'] ?? ''} • ${widget.member['Phone Number'] ?? 'No phone'}'),
                  const SizedBox(height: 16),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    _Summary(
                        label: 'Paid',
                        value: _money(widget.member['Amount Paid']),
                        color: AppColors.success),
                    _Summary(
                        label: 'Remaining',
                        value: _money(widget.member['Remaining Balance']),
                        color: AppColors.warning),
                  ]),
                  const SizedBox(height: 14),
                  Row(children: [
                    Expanded(
                        child: FilledButton.icon(
                            onPressed: _message,
                            icon: const Icon(Icons.chat_outlined),
                            label: const Text('WhatsApp'))),
                    if (!widget.readOnly && widget.onPayment != null) ...[
                      const SizedBox(width: 10),
                      Expanded(
                          child: OutlinedButton.icon(
                              onPressed: widget.onPayment,
                              icon: const Icon(Icons.add_card),
                              label: const Text('Payment'))),
                    ]
                  ]),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => showAiMessageDraft(
                        context,
                        widget.store,
                        widget.member,
                        openMessage: (message) => openWhatsApp(context, message,
                            phone: widget.member['Phone Number']),
                      ),
                      icon: const Icon(Icons.auto_awesome_outlined),
                      label: const Text('Create smart reminder'),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text('Monthly history',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  if (snapshot.connectionState == ConnectionState.waiting)
                    const LinearProgressIndicator()
                  else if (snapshot.hasError)
                    _InlineError(
                        message: snapshot.error.toString(),
                        retry: () => setState(() => future = _load()))
                  else if (history.isEmpty)
                    const _Empty(
                        text: 'No monthly history found for this member.')
                  else
                    ...history.map((row) => _HistoryCard(row: row)),
                  const SizedBox(height: 24),
                  Text('Reminder & reply timeline',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  if (followUps.isEmpty)
                    const _Empty(text: 'No reminder or reply events yet.')
                  else
                    ...followUps
                        .toList()
                        .reversed
                        .map((event) => _TimelineEvent(event: event)),
                ]));
          }));
}

Future<void> showMemberEditor(BuildContext context, FinanceStore store,
    {Map<String, dynamic>? member}) async {
  final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _MemberEditor(store: store, member: member));
  if (result == null) return;
  try {
    await store.saveMember(result,
        rowId: member == null ? null : int.parse(member['_rowId'].toString()));
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
  }
}

class _MemberEditor extends StatefulWidget {
  const _MemberEditor({required this.store, this.member});
  final FinanceStore store;
  final Map<String, dynamic>? member;
  @override
  State<_MemberEditor> createState() => _MemberEditorState();
}

class _MemberEditorState extends State<_MemberEditor> {
  final key = GlobalKey<FormState>();
  late final TextEditingController name,
      phone,
      designation,
      fund,
      previous,
      remarks;
  String category = 'Fellow Member (FM)';
  @override
  void initState() {
    super.initState();
    final m = widget.member;
    name = TextEditingController(text: m?['Name']?.toString() ?? '');
    phone = TextEditingController(text: m?['Phone Number']?.toString() ?? '');
    designation =
        TextEditingController(text: m?['Designation']?.toString() ?? '');
    fund = TextEditingController(
        text: m?['Monthly Fund']?.toString() ??
            widget.store.settings['DEFAULT_MONTHLY_FUND']?.toString() ??
            '500');
    previous =
        TextEditingController(text: m?['Previous Balance']?.toString() ?? '0');
    remarks = TextEditingController(text: m?['Remarks']?.toString() ?? '');
    category = m?['Member Category']?.toString() ?? category;
  }

  @override
  void dispose() {
    for (final c in [name, phone, designation, fund, previous, remarks])
      c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => Padding(
      padding: EdgeInsets.fromLTRB(
          20, 0, 20, MediaQuery.viewInsetsOf(c).bottom + 24),
      child: Form(
          key: key,
          child: SingleChildScrollView(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                Text(widget.member == null ? 'Add member' : 'Edit member',
                    style: Theme.of(c).textTheme.titleLarge),
                const SizedBox(height: 14),
                TextFormField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Name'),
                    validator: (v) =>
                        v?.trim().isEmpty == true ? 'Name is required' : null),
                const SizedBox(height: 10),
                TextFormField(
                    controller: phone,
                    keyboardType: TextInputType.phone,
                    decoration:
                        const InputDecoration(labelText: 'Phone number')),
                const SizedBox(height: 10),
                TextFormField(
                    controller: designation,
                    decoration:
                        const InputDecoration(labelText: 'Designation')),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                    initialValue: category,
                    decoration:
                        const InputDecoration(labelText: 'Member category'),
                    items: const [
                      'Fellow Member (FM)',
                      'Study Circle Member (SC)',
                      'Jaiza Pass Member (JP)'
                    ]
                        .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                        .toList(),
                    onChanged: (v) => setState(() => category = v!)),
                const SizedBox(height: 10),
                TextFormField(
                    controller: fund,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Monthly fund', prefixText: 'Rs '),
                    validator: (v) => (double.tryParse(v ?? '') ?? -1) < 0
                        ? 'Enter a valid amount'
                        : null),
                if (widget.member == null) ...[
                  const SizedBox(height: 10),
                  TextFormField(
                      controller: previous,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          labelText: 'Previous balance', prefixText: 'Rs '))
                ],
                const SizedBox(height: 10),
                TextFormField(
                    controller: remarks,
                    decoration: const InputDecoration(labelText: 'Remarks')),
                const SizedBox(height: 18),
                FilledButton(
                    onPressed: () {
                      if (!(key.currentState?.validate() ?? false)) return;
                      final monthly = double.parse(fund.text),
                          prev = double.tryParse(previous.text) ?? 0;
                      final data = <String, dynamic>{
                        'Name': name.text.trim(),
                        'Phone Number': phone.text.trim(),
                        'Designation': designation.text.trim(),
                        'Member Category': category,
                        'Monthly Fund': monthly,
                        'Remarks': remarks.text.trim()
                      };
                      if (widget.member == null)
                        data.addAll({
                          'Previous Balance': prev,
                          'Total Payable': monthly + prev,
                          'Amount Paid': 0,
                          'Remaining Balance': monthly + prev,
                          'Payment Status': 'Pending'
                        });
                      Navigator.pop(c, data);
                    },
                    child: const Text('Save member'))
              ]))));
}

Future<void> showFollowUpEditor(BuildContext context, FinanceStore store,
    Map<String, dynamic> member) async {
  final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _FollowUpEditor());
  if (result == null) return;
  try {
    await store.addFollowUp(member, result);
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
  }
}

class _FollowUpEditor extends StatefulWidget {
  const _FollowUpEditor();
  @override
  State<_FollowUpEditor> createState() => _FollowUpEditorState();
}

class _FollowUpEditorState extends State<_FollowUpEditor> {
  String status = 'Replied';
  final reason = TextEditingController(),
      notes = TextEditingController(),
      next = TextEditingController();
  @override
  void dispose() {
    reason.dispose();
    notes.dispose();
    next.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => Padding(
      padding: EdgeInsets.fromLTRB(
          20, 0, 20, MediaQuery.viewInsetsOf(c).bottom + 24),
      child: SingleChildScrollView(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Log follow-up', style: Theme.of(c).textTheme.titleLarge),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
            initialValue: status,
            decoration: const InputDecoration(labelText: 'Reply status'),
            items: const [
              'Replied',
              'No Reply',
              'Promised to Pay',
              'Unable to Pay',
              'Paid'
            ].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
            onChanged: (v) => setState(() => status = v!)),
        const SizedBox(height: 10),
        TextField(
            controller: reason,
            decoration: const InputDecoration(labelText: 'Reason / reply')),
        const SizedBox(height: 10),
        TextField(
            controller: next,
            keyboardType: TextInputType.datetime,
            decoration: const InputDecoration(
                labelText: 'Next reminder date', hintText: 'YYYY-MM-DD')),
        const SizedBox(height: 10),
        TextField(
            controller: notes,
            decoration: const InputDecoration(labelText: 'Notes')),
        const SizedBox(height: 18),
        FilledButton(
            onPressed: () => Navigator.pop(c, {
                  'Event Type': 'Reply Received',
                  'Reply Status': status,
                  'Reason / Reply': reason.text.trim(),
                  'Next Reminder Date': next.text.trim(),
                  'Notes': notes.text.trim()
                }),
            child: const Text('Save follow-up'))
      ])));
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.row});
  final Map<String, dynamic> row;
  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ExpansionTile(
          title: Text(
              row['month']?.toString() ?? row['Month']?.toString() ?? 'Month'),
          subtitle: Text(
              '${row['Payment Status'] ?? 'Pending'} • paid ${_money(row['Amount Paid'])}'),
          trailing: Text(_money(row['Remaining Balance']),
              style: const TextStyle(fontWeight: FontWeight.w800)),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            _Pair(label: 'Monthly fund', value: _money(row['Monthly Fund'])),
            _Pair(
                label: 'Previous balance',
                value: _money(row['Previous Balance'])),
            _Pair(label: 'Total payable', value: _money(row['Total Payable'])),
            _Pair(
                label: 'Payment date', value: _dateLabel(row['Payment Date'])),
          ]));
}

class _TimelineEvent extends StatelessWidget {
  const _TimelineEvent({required this.event});
  final Map<String, dynamic> event;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Column(children: [
          Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Theme.of(context).colorScheme.primary)),
          Expanded(
              child: Container(
                  width: 2,
                  color: Theme.of(context).colorScheme.outlineVariant))
        ]),
        const SizedBox(width: 12),
        Expanded(
            child: Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(event['Event Type']?.toString() ?? 'Activity',
                          style: Theme.of(context).textTheme.titleMedium),
                      Text(
                          '${_dateLabel(event['Event Date'])} • ${event['Reply Status'] ?? 'No status'}'),
                      if ((event['Reason / Reply'] ?? event['Notes'] ?? '')
                          .toString()
                          .isNotEmpty)
                        Text((event['Reason / Reply'] ?? event['Notes'])
                            .toString()),
                      if ((event['Next Reminder Date'] ?? '')
                          .toString()
                          .isNotEmpty)
                        Text(
                            'Next reminder: ${_dateLabel(event['Next Reminder Date'])}'),
                    ])))
      ]));
}

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key, required this.store});
  final FinanceStore store;
  @override
  Widget build(BuildContext context) {
    final paid =
        store.members.where((m) => m['Payment Status'] == 'Paid').length;
    final partial = store.members
        .where((m) => m['Payment Status'] == 'Partially Paid')
        .length;
    final pending = store.members.length - paid - partial;
    return Scaffold(
        appBar: AppBar(title: const Text('Reports')),
        body: RefreshIndicator(
            onRefresh: store.refresh,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Text('Monthly performance',
                  style: Theme.of(context).textTheme.headlineMedium),
              Text('Reporting period: ${store.month}'),
              const SizedBox(height: 18),
              Wrap(spacing: 10, runSpacing: 10, children: [
                _Summary(
                    label: 'Collected',
                    value: _money(store.collected),
                    color: AppColors.success),
                _Summary(
                    label: 'Outstanding',
                    value: _money(store.outstanding),
                    color: AppColors.warning),
                _Summary(
                    label: 'Expenses',
                    value: _money(store.spent),
                    color: AppColors.error),
                _Summary(
                    label: 'Cash',
                    value: _money(store.balance),
                    color: AppColors.emerald),
              ]),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                  onPressed: () => showAiReportSheet(context, store),
                  icon: const Icon(Icons.auto_awesome_outlined),
                  label: const Text('Generate AI narrative')),
              const SizedBox(height: 10),
              Card(
                  child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(children: [
                        _Pair(label: 'Paid members', value: '$paid'),
                        _Pair(label: 'Partially paid', value: '$partial'),
                        _Pair(label: 'Pending', value: '$pending'),
                      ]))),
              const SizedBox(height: 14),
              FilledButton.icon(
                  onPressed: () => openWhatsApp(
                      context,
                      applyTemplate(
                          template(store, 'WHATSAPP_MONTHLY_REPORT_TEMPLATE'),
                          templateValues(store))),
                  icon: const Icon(Icons.send_outlined),
                  label: const Text('Share monthly report on WhatsApp')),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                  onPressed: () => openWhatsApp(
                      context,
                      applyTemplate(template(store, 'WHATSAPP_REPORT_TEMPLATE'),
                          templateValues(store))),
                  icon: const Icon(Icons.copy_all_outlined),
                  label: const Text('Share detailed report')),
            ])));
  }
}

class SpecialFundScreen extends StatefulWidget {
  const SpecialFundScreen(
      {super.key, required this.store, required this.readOnly});
  final FinanceStore store;
  final bool readOnly;
  @override
  State<SpecialFundScreen> createState() => _SpecialFundScreenState();
}

class _SpecialFundScreenState extends State<SpecialFundScreen> {
  String query = '';
  double minimum(Map<String, dynamic> m) {
    final category = m['Member Category']?.toString() ?? '';
    final key = category.contains('Jaiza') || category.contains('JP')
        ? 'SPECIAL_FUND_JP_MINIMUM'
        : category.contains('Study') || category.contains('SC')
            ? 'SPECIAL_FUND_SC_MINIMUM'
            : 'SPECIAL_FUND_FM_MINIMUM';
    return number(widget.store.settings[key]);
  }

  double paid(Map<String, dynamic> m) => widget.store.contributions
      .where((e) =>
          (e['Phone Number']?.toString().isNotEmpty == true &&
              e['Phone Number'].toString() == m['Phone Number']?.toString()) ||
          e['Member Name'] == m['Name'])
      .fold(0, (s, e) => s + number(e['Amount Paid']));
  @override
  Widget build(BuildContext context) {
    final total = widget.store.contributions
        .fold<double>(0, (s, e) => s + number(e['Amount Paid']));
    final list = widget.store.members
        .where((m) => '${m['Name']} ${m['Phone Number']}'
            .toLowerCase()
            .contains(query.toLowerCase()))
        .toList();
    return Scaffold(
        appBar: AppBar(title: const Text('Special Fund'), actions: [
          IconButton(
              tooltip: 'Share report',
              onPressed: () => openWhatsApp(
                  context,
                  applyTemplate(
                      template(widget.store, 'SPECIAL_FUND_REPORT_TEMPLATE'),
                      templateValues(widget.store))),
              icon: const Icon(Icons.ios_share))
        ]),
        floatingActionButton: widget.readOnly
            ? null
            : FloatingActionButton.extended(
                onPressed: () => _contribution(context),
                icon: const Icon(Icons.add),
                label: const Text('Contribution')),
        body: RefreshIndicator(
            onRefresh: widget.store.refresh,
            child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                children: [
                  Text(
                      widget.store.settings['SPECIAL_FUND_CAMPAIGN_NAME']
                              ?.toString() ??
                          'Special Fund',
                      style: Theme.of(context).textTheme.headlineMedium),
                  Text(
                      '${widget.store.contributions.length} entries • ${_money(total)} collected'),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                      onPressed: () => openWhatsApp(
                          context,
                          applyTemplate(
                              widget.store
                                      .settings['SPECIAL_FUND_MESSAGE_TEMPLATE']
                                      ?.toString() ??
                                  '',
                              templateValues(widget.store))),
                      icon: const Icon(Icons.campaign_outlined),
                      label: const Text('Share campaign appeal')),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                      onPressed: () => showAiReportSheet(context, widget.store,
                          reportType: 'special-fund'),
                      icon: const Icon(Icons.auto_awesome_outlined),
                      label: const Text('Generate campaign narrative')),
                  const SizedBox(height: 16),
                  TextField(
                      onChanged: (v) => setState(() => query = v),
                      decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          hintText: 'Search campaign members')),
                  const SizedBox(height: 14),
                  ...list.map((m) {
                    final target = minimum(m),
                        collected = paid(m),
                        remaining = (target - collected)
                            .clamp(0, double.infinity)
                            .toDouble();
                    return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                            title: Text(m['Name']?.toString() ?? 'Member'),
                            subtitle: Text(
                                '${m['Member Category'] ?? ''}\nCollected ${_money(collected)} • Remaining ${_money(remaining)}'),
                            isThreeLine: true,
                            trailing: PopupMenuButton<String>(
                                onSelected: (value) {
                                  if (value == 'message')
                                    _fundMessage(m, collected, remaining);
                                  if (value == 'add')
                                    _contribution(context, member: m);
                                },
                                itemBuilder: (_) => [
                                      const PopupMenuItem(
                                          value: 'message',
                                          child: Text('Send appeal')),
                                      if (!widget.readOnly)
                                        const PopupMenuItem(
                                            value: 'add',
                                            child: Text('Record contribution'))
                                    ])));
                  }),
                  const SizedBox(height: 18),
                  Text('Contribution ledger',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  if (widget.store.contributions.isEmpty)
                    const _Empty(text: 'No contributions have been recorded.')
                  else
                    ...widget.store.contributions.map((e) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                            title:
                                Text(e['Member Name']?.toString() ?? 'Member'),
                            subtitle: Text(
                                '${_dateLabel(e['Payment Date'])} • ${e['Remarks'] ?? ''}'),
                            trailing: Text(_money(e['Amount Paid']),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800)))))
                ])));
  }

  Future<void> _fundMessage(
      Map<String, dynamic> member, double collected, double remaining) async {
    if (_phone(member['Phone Number']).isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('This member has no valid phone number.')));
      return;
    }
    final values = {
      ...templateValues(widget.store, member),
      'fund_amount': _money(collected),
      'balance': _money(remaining)
    };
    await openWhatsApp(
        context,
        applyTemplate(
            widget.store.settings['SPECIAL_FUND_MESSAGE_TEMPLATE']
                    ?.toString() ??
                '',
            values),
        phone: member['Phone Number']);
  }

  Future<void> _contribution(BuildContext context,
      {Map<String, dynamic>? member}) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) =>
            _ContributionSheet(store: widget.store, initial: member));
    if (result == null) return;
    try {
      await widget.store.saveContribution(result);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }
}

class _ContributionSheet extends StatefulWidget {
  const _ContributionSheet({required this.store, this.initial});
  final FinanceStore store;
  final Map<String, dynamic>? initial;
  @override
  State<_ContributionSheet> createState() => _ContributionSheetState();
}

class _ContributionSheetState extends State<_ContributionSheet> {
  final key = GlobalKey<FormState>(),
      amount = TextEditingController(),
      remarks = TextEditingController(),
      receipt = TextEditingController();
  Map<String, dynamic>? member;
  @override
  void initState() {
    super.initState();
    member = widget.initial;
  }

  @override
  void dispose() {
    amount.dispose();
    remarks.dispose();
    receipt.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
      padding: EdgeInsets.fromLTRB(
          20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Form(
          key: key,
          child: SingleChildScrollView(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                Text('Record contribution',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                DropdownButtonFormField<Map<String, dynamic>>(
                    initialValue: member,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Member'),
                    items: widget.store.members
                        .map((m) => DropdownMenuItem(
                            value: m,
                            child: Text(m['Name']?.toString() ?? 'Member')))
                        .toList(),
                    onChanged: (v) => setState(() => member = v),
                    validator: (v) => v == null ? 'Select a member' : null),
                const SizedBox(height: 12),
                TextFormField(
                    controller: amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Amount', prefixText: 'Rs '),
                    validator: (v) => (double.tryParse(v ?? '') ?? 0) <= 0
                        ? 'Enter an amount greater than zero'
                        : null),
                const SizedBox(height: 12),
                TextFormField(
                    controller: receipt,
                    decoration: const InputDecoration(
                        labelText: 'Receipt link (optional)')),
                const SizedBox(height: 12),
                TextFormField(
                    controller: remarks,
                    decoration:
                        const InputDecoration(labelText: 'Remarks (optional)')),
                const SizedBox(height: 18),
                FilledButton(
                    onPressed: () {
                      if (!(key.currentState?.validate() ?? false) ||
                          member == null) return;
                      Navigator.pop(context, {
                        'Campaign ID':
                            widget.store.settings['SPECIAL_FUND_CAMPAIGN_ID'] ??
                                'central-convention-2027',
                        'Member Name': member!['Name'],
                        'Phone Number': member!['Phone Number'],
                        'Member Category': member!['Member Category'],
                        'Amount Paid': double.parse(amount.text),
                        'Payment Date':
                            DateTime.now().toIso8601String().substring(0, 10),
                        'Receipt Link': receipt.text.trim(),
                        'Remarks': remarks.text.trim()
                      });
                    },
                    child: const Text('Save contribution'))
              ]))));
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen(
      {super.key, required this.store, required this.readOnly});
  final FinanceStore store;
  final bool readOnly;
  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _NavCard(
            icon: Icons.business_outlined,
            title: 'Organization settings',
            subtitle: 'Organization, sector, payment and monthly defaults',
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => OrganizationSettings(
                        store: store, readOnly: readOnly)))),
        _NavCard(
            icon: Icons.message_outlined,
            title: 'Message templates',
            subtitle: 'Member, reports, monthly and special-fund messages',
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) =>
                        TemplateSettings(store: store, readOnly: readOnly)))),
        if (!readOnly)
          _NavCard(
              icon: Icons.calendar_month_outlined,
              title: 'Create reporting month',
              subtitle: 'Optionally carry outstanding balances forward',
              onTap: () => _newMonth(context)),
        if (!readOnly)
          _NavCard(
              icon: Icons.health_and_safety_outlined,
              title: 'Data diagnostics',
              subtitle: 'Inspect Sheets mapping and repair month columns',
              onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => DiagnosticsScreen(store: store)))),
      ]));
  Future<void> _newMonth(BuildContext context) async {
    final name = TextEditingController();
    bool carry = true;
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
            builder: (c, set) => AlertDialog(
                    title: const Text('Create reporting month'),
                    content: Column(mainAxisSize: MainAxisSize.min, children: [
                      TextField(
                          controller: name,
                          decoration: const InputDecoration(
                              labelText: 'Month name',
                              hintText: 'October 2026')),
                      SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          value: carry,
                          onChanged: (v) => set(() => carry = v),
                          title: const Text('Carry balances forward'))
                    ]),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(c, false),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: () => Navigator.pop(c, true),
                          child: const Text('Create'))
                    ])));
    if (ok == true && name.text.trim().isNotEmpty) {
      try {
        await store.createMonth(name.text.trim(), carry);
      } catch (e) {
        if (context.mounted)
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
    name.dispose();
  }
}

class OrganizationSettings extends StatefulWidget {
  const OrganizationSettings(
      {super.key, required this.store, required this.readOnly});
  final FinanceStore store;
  final bool readOnly;
  @override
  State<OrganizationSettings> createState() => _OrganizationSettingsState();
}

class _OrganizationSettingsState extends State<OrganizationSettings> {
  late final Map<String, TextEditingController> fields;
  final keys = [
    'ORG_NAME',
    'SECTOR_NAME',
    'SECRETARY_NAME',
    'DEFAULT_MONTHLY_FUND',
    'EASYPAISA_NUMBER',
    'ACCOUNT_TITLE'
  ];
  final labels = [
    'Organization name',
    'Sector name',
    'Secretary name',
    'Default monthly fund',
    'Easypaisa number',
    'Account title'
  ];
  @override
  void initState() {
    super.initState();
    fields = {
      for (final k in keys)
        k: TextEditingController(
            text: widget.store.settings[k]?.toString() ?? '')
    };
  }

  @override
  void dispose() {
    for (final c in fields.values) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => Scaffold(
      appBar: AppBar(title: const Text('Organization settings')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        ...List.generate(
            keys.length,
            (i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                    controller: fields[keys[i]],
                    enabled: !widget.readOnly,
                    keyboardType: keys[i] == 'DEFAULT_MONTHLY_FUND'
                        ? TextInputType.number
                        : null,
                    decoration: InputDecoration(labelText: labels[i])))),
        if (!widget.readOnly)
          FilledButton(
              onPressed: () async {
                await widget.store.saveSettings(
                    {for (final k in keys) k: fields[k]!.text.trim()});
                if (c.mounted) Navigator.pop(c);
              },
              child: const Text('Save settings'))
      ]));
}

class TemplateSettings extends StatelessWidget {
  const TemplateSettings(
      {super.key, required this.store, required this.readOnly});
  final FinanceStore store;
  final bool readOnly;
  @override
  Widget build(BuildContext c) {
    const entries = [
      (
        'WHATSAPP_MEMBER_TEMPLATE',
        'Regular member message',
        'Payment reminders and member-specific messages'
      ),
      (
        'WHATSAPP_REPORT_TEMPLATE',
        'Report sharing message',
        'Detailed finance report sharing'
      ),
      (
        'WHATSAPP_MONTHLY_REPORT_TEMPLATE',
        'Monthly report message',
        'Monthly summary with a report period'
      ),
      (
        'SPECIAL_FUND_MESSAGE_TEMPLATE',
        'Special fund message',
        'Campaign appeals to individual members'
      ),
      (
        'SPECIAL_FUND_REPORT_TEMPLATE',
        'Special fund report message',
        'Campaign reporting and totals'
      ),
      (
        'AI_REPORT_TEMPLATE',
        'AI report layout',
        'Wrap every AI narrative in your approved report pattern'
      ),
      (
        'AI_MESSAGE_TEMPLATE',
        'AI message layout',
        'Apply your approved structure to every AI-assisted draft'
      )
    ];
    return Scaffold(
        appBar: AppBar(title: const Text('Message templates')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          Card(
              child: ListTile(
                  leading: const Icon(Icons.data_object),
                  title: const Text('Variable values'),
                  subtitle: const Text(
                      'See exactly what every placeholder resolves to'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                      c,
                      MaterialPageRoute(
                          builder: (_) =>
                              TemplateVariablesScreen(store: store))))),
          const SizedBox(height: 12),
          ...entries.map((e) => _NavCard(
              icon: Icons.edit_note,
              title: e.$2,
              subtitle: e.$3,
              onTap: () => Navigator.push(
                  c,
                  MaterialPageRoute(
                      builder: (_) => TemplateEditor(
                          store: store,
                          settingKey: e.$1,
                          title: e.$2,
                          readOnly: readOnly)))))
        ]));
  }
}

class TemplateVariablesScreen extends StatelessWidget {
  const TemplateVariablesScreen({super.key, required this.store});
  final FinanceStore store;

  @override
  Widget build(BuildContext context) {
    final sample = store.members.firstOrNull;
    final values = templateValues(store, sample);
    return Scaffold(
      appBar: AppBar(title: const Text('Variable values')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Icon(Icons.info_outline,
                    color: Theme.of(context).colorScheme.onPrimaryContainer),
                const SizedBox(width: 12),
                Expanded(
                    child: Text(
                  sample == null
                      ? 'Finance variables use the selected month. Member variables are blank until a member exists.'
                      : 'Member-specific values use ${sample['Name']} as the live example.',
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onPrimaryContainer),
                )),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          ...templateVariableNames.map((name) => Card(
                child: ListTile(
                  title: Text('{$name}',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: SelectableText(
                      values[name]?.toString().isNotEmpty == true
                          ? values[name].toString()
                          : 'Not set'),
                  trailing: IconButton(
                    tooltip: 'Copy variable',
                    icon: const Icon(Icons.copy_outlined),
                    onPressed: () =>
                        Clipboard.setData(ClipboardData(text: '{$name}')),
                  ),
                ),
              )),
        ],
      ),
    );
  }
}

class TemplateEditor extends StatefulWidget {
  const TemplateEditor(
      {super.key,
      required this.store,
      required this.settingKey,
      required this.title,
      required this.readOnly});
  final FinanceStore store;
  final String settingKey, title;
  final bool readOnly;
  @override
  State<TemplateEditor> createState() => _TemplateEditorState();
}

class _TemplateEditorState extends State<TemplateEditor> {
  late final TextEditingController text;
  @override
  void initState() {
    super.initState();
    text =
        TextEditingController(text: template(widget.store, widget.settingKey));
  }

  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  void insert(String variable) {
    final value = '{$variable}', selection = text.selection;
    final start = selection.isValid ? selection.start : text.text.length;
    final end = selection.isValid ? selection.end : text.text.length;
    text.value = TextEditingValue(
        text: text.text.replaceRange(start, end, value),
        selection: TextSelection.collapsed(offset: start + value.length));
    setState(() {});
  }

  @override
  Widget build(BuildContext c) => PopScope(
        canPop: false,
        onPopInvokedWithResult: (p, _) async {
          if (p) return;
          final leave = widget.readOnly ||
              text.text == template(widget.store, widget.settingKey) ||
              await showDialog<bool>(
                      context: c,
                      builder: (d) => AlertDialog(
                              title: const Text('Discard changes?'),
                              content: const Text(
                                  'Your unsaved template edits will be lost.'),
                              actions: [
                                TextButton(
                                    onPressed: () => Navigator.pop(d, false),
                                    child: const Text('Keep editing')),
                                FilledButton(
                                    onPressed: () => Navigator.pop(d, true),
                                    child: const Text('Discard'))
                              ])) ==
                  true;
          if (leave && c.mounted) Navigator.pop(c);
        },
        child: Scaffold(
            appBar: AppBar(title: Text(widget.title)),
            body: ListView(padding: const EdgeInsets.all(16), children: [
              TextField(
                  controller: text,
                  enabled: !widget.readOnly,
                  minLines: 8,
                  maxLines: 16,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                      labelText: 'Message', alignLabelWithHint: true)),
              const SizedBox(height: 14),
              Text('Available variables',
                  style: Theme.of(c).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: templateVariableNames
                      .map((v) => ActionChip(
                          label: Text('{$v}'),
                          onPressed: widget.readOnly ? null : () => insert(v)))
                      .toList()),
              const SizedBox(height: 20),
              Text('Live preview', style: Theme.of(c).textTheme.titleMedium),
              const SizedBox(height: 8),
              Card(
                  child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: SelectableText(applyTemplate(
                          text.text,
                          templateValues(widget.store,
                              widget.store.members.firstOrNull))))),
              if (!widget.readOnly) ...[
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(
                      child: OutlinedButton(
                          onPressed: () {
                            text.text = defaultTemplates[widget.settingKey] ??
                                widget.store
                                    .settings['SPECIAL_FUND_MESSAGE_TEMPLATE']
                                    ?.toString() ??
                                '';
                            setState(() {});
                          },
                          child: const Text('Reset default'))),
                  const SizedBox(width: 10),
                  Expanded(
                      child: FilledButton(
                          onPressed: text.text.trim().isEmpty
                              ? null
                              : () async {
                                  await widget.store.saveSettings(
                                      {widget.settingKey: text.text.trim()});
                                  if (c.mounted) Navigator.pop(c);
                                },
                          child: const Text('Save'))),
                ])
              ]
            ])),
      );
}

class DiagnosticsScreen extends StatefulWidget {
  const DiagnosticsScreen({super.key, required this.store});
  final FinanceStore store;
  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  String output = 'No diagnostic run yet.';
  bool busy = false;
  Future<void> run(String path) async {
    setState(() => busy = true);
    try {
      final r = await widget.store.api.request(path,
          method: path.contains('repair') ? 'POST' : 'GET',
          query:
              path.contains('repair') ? null : {'month': widget.store.month});
      setState(() => output = r['data'].toString());
    } catch (e) {
      setState(() => output = e.toString());
    } finally {
      setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
      appBar: AppBar(title: const Text('Data diagnostics')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        FilledButton.icon(
            onPressed: busy ? null : () => run('/api/diagnostics'),
            icon: const Icon(Icons.medical_services_outlined),
            label: const Text('Run diagnostics')),
        const SizedBox(height: 10),
        OutlinedButton.icon(
            onPressed: busy
                ? null
                : () => run('/api/diagnostics/repair-month-columns'),
            icon: const Icon(Icons.build_outlined),
            label: const Text('Repair month values')),
        const SizedBox(height: 16),
        Card(
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: SelectableText(output)))
      ]));
}

class _Summary extends StatelessWidget {
  const _Summary(
      {required this.label, required this.value, required this.color});
  final String label, value;
  final Color color;
  @override
  Widget build(BuildContext c) => SizedBox(
      width: (MediaQuery.sizeOf(c).width - 42) / 2,
      child: Card(
          child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label),
                    const SizedBox(height: 5),
                    Text(value,
                        style: Theme.of(c)
                            .textTheme
                            .titleMedium
                            ?.copyWith(color: color))
                  ]))));
}

class _Pair extends StatelessWidget {
  const _Pair({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext c) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(child: Text(label)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700))
      ]));
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;
  @override
  Widget build(BuildContext c) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 22),
      child: Center(
          child: Text(text,
              textAlign: TextAlign.center,
              style:
                  TextStyle(color: Theme.of(c).colorScheme.onSurfaceVariant))));
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext c) => Card(
      child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Text(message),
            TextButton(onPressed: retry, child: const Text('Try again'))
          ])));
}

class _NavCard extends StatelessWidget {
  const _NavCard(
      {required this.icon,
      required this.title,
      required this.subtitle,
      required this.onTap});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
          onTap: onTap,
          leading: Icon(icon, color: Theme.of(c).colorScheme.primary),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right)));
}
