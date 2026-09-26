import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'finance_store.dart';
import 'templates.dart';
import 'theme.dart';

class AiCapabilities {
  const AiCapabilities({required this.enabled, required this.privacyNote});
  final bool enabled;
  final String privacyNote;

  factory AiCapabilities.from(Map<String, dynamic> value) => AiCapabilities(
        enabled: value['enabled'] == true,
        privacyNote: value['privacyNote']?.toString() ??
            'AI uses minimized finance facts. Review generated content.',
      );
}

class AiResult {
  const AiResult({
    required this.content,
    required this.generatedAt,
    required this.facts,
    required this.requestId,
  });
  final String content;
  final DateTime? generatedAt;
  final Map<String, dynamic> facts;
  final String requestId;

  AiResult withContent(String value) => AiResult(
        content: value,
        generatedAt: generatedAt,
        facts: facts,
        requestId: requestId,
      );

  factory AiResult.from(Map<String, dynamic> envelope) {
    final data =
        Map<String, dynamic>.from(envelope['data'] as Map? ?? const {});
    final usage =
        Map<String, dynamic>.from(envelope['usage'] as Map? ?? const {});
    return AiResult(
      content: data['content']?.toString() ?? '',
      generatedAt: DateTime.tryParse(data['generatedAt']?.toString() ?? ''),
      facts: Map<String, dynamic>.from(data['facts'] as Map? ?? const {}),
      requestId: usage['requestId']?.toString() ?? '',
    );
  }
}

extension AiFinanceStore on FinanceStore {
  Future<AiCapabilities> aiCapabilities() async {
    final response = await api.request('/api/ai/capabilities');
    return AiCapabilities.from(
        Map<String, dynamic>.from(response['data'] as Map? ?? const {}));
  }

  Future<AiResult> aiBriefing({
    String detail = 'month',
    String language = 'bilingual',
  }) async {
    final response =
        await api.request('/api/ai/briefing', method: 'POST', body: {
      'month': month,
      'detail': detail,
      'language': language,
      if (detail == 'comparison') 'comparisonMonth': previousMonth,
    });
    return AiResult.from(response);
  }

  Future<AiResult> aiReport({
    String reportType = 'monthly',
    String language = 'bilingual',
  }) async {
    final response = await api.request('/api/ai/report-summary',
        method: 'POST',
        body: {'month': month, 'reportType': reportType, 'language': language});
    return AiResult.from(response);
  }

  Future<AiResult> aiMessageDraft(
    Map<String, dynamic> member, {
    String tone = 'polite',
    String language = 'bilingual',
  }) async {
    final response =
        await api.request('/api/ai/message-draft', method: 'POST', body: {
      'month': month,
      'memberRowId': member['_rowId'],
      'tone': tone,
      'language': language,
    });
    return AiResult.from(response);
  }

  Future<Map<String, dynamic>> aiParseEntry(String text) async {
    final response = await api.request('/api/ai/parse-entry',
        method: 'POST', body: {'month': month, 'text': text});
    final data =
        Map<String, dynamic>.from(response['data'] as Map? ?? const {});
    return Map<String, dynamic>.from(data['proposal'] as Map? ?? const {});
  }

  Future<AiResult> aiDataReview({String language = 'bilingual'}) async {
    final response = await api.request('/api/ai/data-review',
        method: 'POST', body: {'month': month, 'language': language});
    return AiResult.from(response);
  }

  Future<AiResult> aiChat(String question,
      {String language = 'bilingual',
      List<Map<String, String>> history = const []}) async {
    final response = await api.request('/api/ai/chat', method: 'POST', body: {
      'month': month,
      'question': question,
      'language': language,
      'history': history,
    });
    return AiResult.from(response);
  }

  Future<Map<String, dynamic>> aiCommand(String request,
      {String language = 'bilingual',
      List<Map<String, String>> history = const []}) async {
    final response =
        await api.request('/api/ai/command', method: 'POST', body: {
      'month': month,
      'request': request,
      'language': language,
      'history': history,
    });
    return Map<String, dynamic>.from(response['data'] as Map? ?? const {});
  }

  String? get previousMonth {
    if (month == null) return null;
    final ordered = months.toList();
    ordered.sort((a, b) {
      final latest = latestMonth([a, b]);
      if (latest == a && latest != b) return 1;
      if (latest == b && latest != a) return -1;
      return a.compareTo(b);
    });
    final index = ordered.indexOf(month!);
    return index > 0 ? ordered[index - 1] : null;
  }
}

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key, required this.store});
  final FinanceStore store;

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  late Future<AiCapabilities> capabilities;
  AiResult? result;
  String detail = 'month';
  String language = 'bilingual';
  bool generating = false;
  String? error;

  @override
  void initState() {
    super.initState();
    capabilities = widget.store.aiCapabilities();
  }

  Future<void> generate() async {
    setState(() {
      generating = true;
      error = null;
    });
    try {
      final value =
          await widget.store.aiBriefing(detail: detail, language: language);
      if (mounted) setState(() => result = value);
    } catch (exception) {
      if (mounted) setState(() => error = exception.toString());
    } finally {
      if (mounted) setState(() => generating = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Management assistant')),
        body: GradientCanvas(
            child: FutureBuilder<AiCapabilities>(
          future: capabilities,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _AiCenteredState(
                  icon: Icons.cloud_off_outlined,
                  title: 'Assistant unavailable',
                  message: snapshot.error.toString(),
                  action: () => setState(
                      () => capabilities = widget.store.aiCapabilities()));
            }
            final value = snapshot.data!;
            if (!value.enabled) {
              return const _AiCenteredState(
                icon: Icons.auto_awesome_outlined,
                title: 'Assistant is not enabled',
                message:
                    'Your finance tools still work normally. An administrator can enable the server-side AI integration when the privacy policy and deployment secrets are ready.',
              );
            }
            return ListView(
              padding: const EdgeInsets.all(AppSpace.lg),
              children: [
                GradientPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.auto_awesome, size: 32),
                      const SizedBox(height: AppSpace.md),
                      Text('Your AI management copilot',
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(color: Colors.white)),
                      const SizedBox(height: AppSpace.sm),
                      const Text(
                          'Ask for a member message, an all-member report, a finance entry, a follow-up plan, or anything else. I’ll use your live data and ask when a detail is missing.'),
                      const SizedBox(height: AppSpace.lg),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.emeraldDark),
                        onPressed: () => showAiChat(context, widget.store),
                        icon: const Icon(Icons.arrow_forward),
                        label: const Text('Ask anything'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpace.lg),
                Text('Start with a task',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: AppSpace.sm),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  ActionChip(
                      avatar: const Icon(Icons.chat_outlined, size: 18),
                      label: const Text('Message a member'),
                      onPressed: () => showAiChat(context, widget.store,
                          initialPrompt:
                              'Prepare a WhatsApp message for a member. Ask me which member and purpose if I have not provided them.')),
                  ActionChip(
                      avatar: const Icon(Icons.groups_outlined, size: 18),
                      label: const Text('Message all members'),
                      onPressed: () => showAiChat(context, widget.store,
                          initialPrompt:
                              'Prepare a personalized WhatsApp message for all members. Ask me for the purpose and tone if needed.')),
                  ActionChip(
                      avatar: const Icon(Icons.summarize_outlined, size: 18),
                      label: const Text('Prepare report'),
                      onPressed: () => showAiChat(context, widget.store,
                          initialPrompt:
                              'Prepare a management report for the selected month using all relevant live data.')),
                  ActionChip(
                      avatar: const Icon(Icons.edit_note, size: 18),
                      label: const Text('Record finance entry'),
                      onPressed: () =>
                          showAiEntryAssistant(context, widget.store)),
                ]),
                const SizedBox(height: AppSpace.lg),
                Text('Briefing workspace',
                    style: Theme.of(context).textTheme.titleLarge),
                Text('Grounded in ${widget.store.month} live finance data'),
                const SizedBox(height: AppSpace.md),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('What should I prepare?',
                            style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: AppSpace.md),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(value: 'today', label: Text('Today')),
                            ButtonSegment(value: 'month', label: Text('Month')),
                            ButtonSegment(
                                value: 'comparison', label: Text('Compare')),
                          ],
                          selected: {detail},
                          onSelectionChanged: (value) {
                            final next = value.first;
                            if (next == 'comparison' &&
                                widget.store.previousMonth == null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text(
                                        'A previous reporting month is not available.')),
                              );
                              return;
                            }
                            setState(() => detail = next);
                          },
                        ),
                        const SizedBox(height: AppSpace.md),
                        DropdownButtonFormField<String>(
                          initialValue: language,
                          decoration:
                              const InputDecoration(labelText: 'Language'),
                          items: const [
                            DropdownMenuItem(
                                value: 'bilingual',
                                child: Text('Urdu + English')),
                            DropdownMenuItem(
                                value: 'urdu', child: Text('Urdu')),
                            DropdownMenuItem(
                                value: 'english', child: Text('English')),
                          ],
                          onChanged: (value) =>
                              setState(() => language = value ?? language),
                        ),
                        const SizedBox(height: AppSpace.lg),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: generating ? null : generate,
                            icon: generating
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.auto_awesome),
                            label: Text(generating
                                ? 'Preparing briefing…'
                                : 'Generate briefing'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: AppSpace.md),
                  _AiError(message: error!, retry: generate),
                ],
                if (result != null) ...[
                  const SizedBox(height: AppSpace.lg),
                  AiResultCard(result: result!),
                ],
                const SizedBox(height: AppSpace.lg),
                Text('Advanced tools',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: AppSpace.sm),
                Card(
                  child: Column(children: [
                    ListTile(
                      leading: const Icon(Icons.edit_note_outlined),
                      title: const Text('Describe a payment or expense'),
                      subtitle: const Text(
                          'Parse into an editable proposal; nothing is saved automatically.'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => showAiEntryAssistant(context, widget.store),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.fact_check_outlined),
                      title: const Text('Review data quality'),
                      subtitle: const Text(
                          'Check amounts, dates, duplicates, and missing follow-ups.'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => showAiReview(context, widget.store),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.forum_outlined),
                      title: const Text('Ask about this month'),
                      subtitle: const Text(
                          'Uses authorized member and finance data, asks clarifying questions, and proposes reviewable actions.'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => showAiChat(context, widget.store),
                    ),
                  ]),
                ),
                const SizedBox(height: AppSpace.lg),
                _PrivacyCard(note: value.privacyNote),
              ],
            );
          },
        )),
      );
}

class AiResultCard extends StatelessWidget {
  const AiResultCard({super.key, required this.result});
  final AiResult result;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.auto_awesome,
                    color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: AppSpace.sm),
                Expanded(
                    child: Text('AI-generated — review before use',
                        style: Theme.of(context).textTheme.titleMedium)),
              ]),
              const SizedBox(height: AppSpace.sm),
              Text(result.facts['dataScope']?.toString() ??
                  result.facts['month']?.toString() ??
                  'Selected finance data'),
              const Divider(height: 28),
              SelectableText(result.content,
                  textDirection: _direction(result.content),
                  style: const TextStyle(height: 1.55)),
              const SizedBox(height: AppSpace.md),
              Wrap(spacing: AppSpace.sm, children: [
                OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: result.content));
                      ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Copied to clipboard')));
                    },
                    icon: const Icon(Icons.copy_outlined),
                    label: const Text('Copy')),
                TextButton.icon(
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content:
                                Text('Thanks. Feedback noted for review.'))),
                    icon: const Icon(Icons.flag_outlined),
                    label: const Text('Report issue')),
              ]),
            ],
          ),
        ),
      );
}

Future<void> showAiReportSheet(BuildContext context, FinanceStore store,
    {String reportType = 'monthly'}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => _AiReportSheet(
      store: store,
      reportType: reportType,
    ),
  );
}

class _AiReportSheet extends StatefulWidget {
  const _AiReportSheet({required this.store, required this.reportType});
  final FinanceStore store;
  final String reportType;
  @override
  State<_AiReportSheet> createState() => _AiReportSheetState();
}

class _AiReportSheetState extends State<_AiReportSheet> {
  late Future<AiResult> future;
  @override
  void initState() {
    super.initState();
    future = _generate();
  }

  Future<AiResult> _generate() async {
    final result = await widget.store.aiReport(reportType: widget.reportType);
    final pattern = template(widget.store, 'AI_REPORT_TEMPLATE');
    return result.withContent(applyTemplate(pattern,
        templateValues(widget.store, null, {'ai_content': result.content})));
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
              16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
          child: ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * .78),
            child: FutureBuilder<AiResult>(
              future: future,
              builder: (context, snapshot) => ListView(children: [
                Text('AI report narrative',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: CircularProgressIndicator()))
                else if (snapshot.hasError)
                  _AiError(
                      message: snapshot.error.toString(),
                      retry: () => setState(() => future = _generate()))
                else
                  AiResultCard(result: snapshot.data!),
              ]),
            ),
          ),
        ),
      );
}

Future<void> showAiMessageDraft(
  BuildContext context,
  FinanceStore store,
  Map<String, dynamic> member, {
  required Future<bool> Function(String message) openMessage,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) =>
        _AiMessageSheet(store: store, member: member, openMessage: openMessage),
  );
}

class _AiMessageSheet extends StatefulWidget {
  const _AiMessageSheet(
      {required this.store, required this.member, required this.openMessage});
  final FinanceStore store;
  final Map<String, dynamic> member;
  final Future<bool> Function(String) openMessage;
  @override
  State<_AiMessageSheet> createState() => _AiMessageSheetState();
}

class _AiMessageSheetState extends State<_AiMessageSheet> {
  String tone = 'polite';
  bool loading = false;
  String? error;
  AiResult? result;
  final controller = TextEditingController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> generate() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final value =
          await widget.store.aiMessageDraft(widget.member, tone: tone);
      final content = applyTemplate(
          template(widget.store, 'AI_MESSAGE_TEMPLATE'),
          templateValues(
              widget.store, widget.member, {'ai_content': value.content}));
      controller.text = content;
      if (mounted) setState(() => result = value.withContent(content));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
              16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
          child: SingleChildScrollView(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Smart reminder',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text('${widget.member['Name']} • ${widget.store.month}'),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                _FactChip(
                    label: 'Payable', value: widget.member['Total Payable']),
                _FactChip(label: 'Paid', value: widget.member['Amount Paid']),
                _FactChip(
                    label: 'Remaining',
                    value: widget.member['Remaining Balance']),
              ]),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: tone,
                decoration: const InputDecoration(labelText: 'Tone'),
                items: const [
                  DropdownMenuItem(value: 'polite', child: Text('Polite')),
                  DropdownMenuItem(value: 'concise', child: Text('Concise')),
                  DropdownMenuItem(value: 'firm', child: Text('Firm')),
                  DropdownMenuItem(
                      value: 'campaign', child: Text('Campaign appeal')),
                ],
                onChanged: (value) => setState(() => tone = value ?? tone),
              ),
              const SizedBox(height: 12),
              if (result == null)
                SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                        onPressed: loading ? null : generate,
                        icon: loading
                            ? const SizedBox.square(
                                dimension: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.auto_awesome),
                        label: Text(loading ? 'Drafting…' : 'Generate draft'))),
              if (error != null) _AiError(message: error!, retry: generate),
              if (result != null) ...[
                TextField(
                  controller: controller,
                  minLines: 7,
                  maxLines: 14,
                  textDirection: _direction(controller.text),
                  decoration: const InputDecoration(
                      labelText: 'Editable message',
                      alignLabelWithHint: true,
                      helperText:
                          'AI-generated — verify the message before opening WhatsApp.'),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: controller.text.trim().isEmpty
                        ? null
                        : () async {
                            final opened = await widget
                                .openMessage(controller.text.trim());
                            if (opened && context.mounted) {
                              Navigator.pop(context);
                            }
                          },
                    icon: const Icon(Icons.chat_outlined),
                    label: const Text('Review complete — open WhatsApp'),
                  ),
                ),
              ],
            ]),
          ),
        ),
      );
}

class _FactChip extends StatelessWidget {
  const _FactChip({required this.label, required this.value});
  final String label;
  final Object? value;
  @override
  Widget build(BuildContext context) => Chip(
      avatar: const Icon(Icons.lock_outline, size: 16),
      label: Text('$label: Rs ${number(value).round()}'));
}

class _PrivacyCard extends StatelessWidget {
  const _PrivacyCard({required this.note});
  final String note;
  @override
  Widget build(BuildContext context) => Card(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.privacy_tip_outlined),
            const SizedBox(width: AppSpace.md),
            Expanded(child: Text(note)),
          ]),
        ),
      );
}

class _AiError extends StatelessWidget {
  const _AiError({required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Card(
        color: Theme.of(context).colorScheme.errorContainer,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Expanded(child: Text(message)),
            TextButton(onPressed: retry, child: const Text('Retry')),
          ]),
        ),
      );
}

class _AiCenteredState extends StatelessWidget {
  const _AiCenteredState(
      {required this.icon,
      required this.title,
      required this.message,
      this.action});
  final IconData icon;
  final String title;
  final String message;
  final VoidCallback? action;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon,
                  size: 48, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              Text(title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
              if (action != null) ...[
                const SizedBox(height: 16),
                FilledButton(onPressed: action, child: const Text('Try again')),
              ],
            ]),
          ),
        ),
      );
}

TextDirection _direction(String text) =>
    RegExp(r'[\u0600-\u06FF]').hasMatch(text)
        ? TextDirection.rtl
        : TextDirection.ltr;

Future<void> showAiEntryAssistant(
    BuildContext context, FinanceStore store) async {
  final input = TextEditingController();
  Map<String, dynamic>? proposal;
  String? error;
  var busy = false;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => StatefulBuilder(builder: (context, setState) {
      Future<void> parse() async {
        if (input.text.trim().isEmpty) return;
        setState(() {
          busy = true;
          error = null;
        });
        try {
          proposal = await store.aiParseEntry(input.text.trim());
        } catch (e) {
          error = e.toString();
        }
        if (context.mounted) setState(() => busy = false);
      }

      Future<void> confirm() async {
        final p = proposal!;
        setState(() => busy = true);
        try {
          if (p['type'] == 'payment') {
            final member = store.members.firstWhere(
                (m) => number(m['_rowId']) == number(p['memberRowId']));
            await store.recordPayment(
                member,
                number(p['cumulativeAmount']),
                p['date']?.toString().isNotEmpty == true
                    ? p['date'].toString()
                    : DateTime.now().toIso8601String().substring(0, 10),
                p['remarks']?.toString() ?? '');
          } else {
            await store.addExpense(
                date: p['date']?.toString().isNotEmpty == true
                    ? p['date'].toString()
                    : DateTime.now().toIso8601String().substring(0, 10),
                category: p['category']?.toString() ?? 'Miscellaneous',
                description: p['description']?.toString() ?? '',
                amount: number(p['amount']),
                paidBy: p['paidBy']?.toString() ?? '',
                remarks: p['remarks']?.toString() ?? '');
          }
          if (context.mounted) Navigator.pop(context);
        } catch (e) {
          if (context.mounted)
            setState(() {
              busy = false;
              error = e.toString();
            });
        }
      }

      return SafeArea(
          child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
              Text('Assisted entry',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              const Text(
                  'Example: “Ali paid another 2,000 today” or “Printing expense 3,500 paid by cash”.'),
              const SizedBox(height: 14),
              TextField(
                  controller: input,
                  maxLength: 600,
                  minLines: 2,
                  maxLines: 5,
                  decoration: const InputDecoration(
                      labelText: 'Describe the entry',
                      alignLabelWithHint: true)),
              FilledButton.icon(
                  onPressed: busy ? null : parse,
                  icon: const Icon(Icons.auto_awesome),
                  label: Text(busy ? 'Working…' : 'Create proposal')),
              if (error != null) _AiError(message: error!, retry: parse),
              if (proposal != null) ...[
                const SizedBox(height: 16),
                Text('Review before saving',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...proposal!.entries.map((e) => ListTile(
                    dense: true,
                    title: Text(e.key),
                    subtitle: Text(e.value?.toString() ?? ''))),
                OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            final edited =
                                await _editEntryProposal(context, proposal!);
                            if (edited != null) {
                              setState(() => proposal = edited);
                            }
                          },
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Edit proposal')),
                const Text(
                    'AI-generated proposal. The normal server validation and your current permissions still apply.'),
                const SizedBox(height: 12),
                FilledButton(
                    onPressed: busy ? null : confirm,
                    child: const Text('Confirm and save')),
              ],
            ])),
      ));
    }),
  );
  input.dispose();
}

Future<Map<String, dynamic>?> _editEntryProposal(
    BuildContext context, Map<String, dynamic> proposal) async {
  final amount = TextEditingController(
      text: (proposal['type'] == 'payment'
              ? proposal['cumulativeAmount']
              : proposal['amount'])
          ?.toString());
  final date = TextEditingController(text: proposal['date']?.toString());
  final description =
      TextEditingController(text: proposal['description']?.toString());
  final paidBy = TextEditingController(text: proposal['paidBy']?.toString());
  final remarks = TextEditingController(text: proposal['remarks']?.toString());
  final key = GlobalKey<FormState>();
  final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => AlertDialog(
            title: const Text('Edit proposed fields'),
            content: Form(
              key: key,
              child: SingleChildScrollView(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  if (proposal['type'] == 'expense') ...[
                    TextFormField(
                        controller: description,
                        decoration:
                            const InputDecoration(labelText: 'Description'),
                        validator: (value) => value?.trim().isEmpty == true
                            ? 'Description is required'
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: paidBy,
                        decoration: const InputDecoration(labelText: 'Paid by'),
                        validator: (value) => value?.trim().isEmpty == true
                            ? 'Paid by is required'
                            : null),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                      controller: amount,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                          labelText: proposal['type'] == 'payment'
                              ? 'Cumulative paid amount'
                              : 'Amount',
                          prefixText: 'Rs '),
                      validator: (value) => number(value) <= 0
                          ? 'Enter an amount greater than zero'
                          : null),
                  const SizedBox(height: 12),
                  TextFormField(
                      controller: date,
                      decoration: const InputDecoration(
                          labelText: 'Date (YYYY-MM-DD)')),
                  const SizedBox(height: 12),
                  TextFormField(
                      controller: remarks,
                      decoration: const InputDecoration(
                          labelText: 'Remarks (optional)')),
                ]),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel')),
              FilledButton(
                  onPressed: () {
                    if (!(key.currentState?.validate() ?? false)) return;
                    final edited = Map<String, dynamic>.from(proposal);
                    edited['date'] = date.text.trim();
                    edited['remarks'] = remarks.text.trim();
                    if (proposal['type'] == 'payment') {
                      final next = number(amount.text);
                      if (next > number(proposal['totalPayable'])) return;
                      edited['cumulativeAmount'] = next;
                    } else {
                      edited['amount'] = number(amount.text);
                      edited['description'] = description.text.trim();
                      edited['paidBy'] = paidBy.text.trim();
                    }
                    Navigator.pop(context, edited);
                  },
                  child: const Text('Apply')),
            ],
          ));
  amount.dispose();
  date.dispose();
  description.dispose();
  paidBy.dispose();
  remarks.dispose();
  return result;
}

Future<void> showAiReview(BuildContext context, FinanceStore store) async {
  await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => Padding(
            padding: const EdgeInsets.all(20),
            child: FutureBuilder<AiResult>(
                future: store.aiDataReview(),
                builder: (context, snapshot) => SizedBox(
                    height: MediaQuery.sizeOf(context).height * .65,
                    child: snapshot.connectionState == ConnectionState.waiting
                        ? const Center(child: CircularProgressIndicator())
                        : snapshot.hasError
                            ? Center(child: Text(snapshot.error.toString()))
                            : ListView(children: [
                                Text('Data-quality review',
                                    style:
                                        Theme.of(context).textTheme.titleLarge),
                                const SizedBox(height: 12),
                                AiResultCard(result: snapshot.data!)
                              ]))),
          ));
}

Future<void> showAiChat(BuildContext context, FinanceStore store,
    {String? initialPrompt}) async {
  final question = TextEditingController(text: initialPrompt ?? '');
  final messages = <Map<String, String>>[];
  var sending = false;
  String renderCommand(Map<String, dynamic> command) {
    final parts = <String>[];
    final answer = command['answer']?.toString().trim() ?? '';
    if (answer.isNotEmpty) parts.add(answer);
    final questions =
        List<dynamic>.from(command['questions'] as List? ?? const []);
    if (questions.isNotEmpty) {
      parts.add(
          'I need ${questions.length == 1 ? 'one detail' : 'a few details'}:\n${questions.map((q) => '• $q').join('\n')}');
    }
    final plan = List<dynamic>.from(command['plan'] as List? ?? const []);
    if (plan.isNotEmpty)
      parts.add(
          'Plan:\n${plan.asMap().entries.map((e) => '${e.key + 1}. ${e.value}').join('\n')}');
    final drafts = List<dynamic>.from(command['drafts'] as List? ?? const []);
    if (drafts.isNotEmpty) {
      parts.add('Prepared drafts (${drafts.length}):\n${drafts.map((d) {
        final item = Map<String, dynamic>.from(d as Map);
        final name = item['recipientName']?.toString().trim();
        return '${name?.isNotEmpty == true ? '$name\n' : ''}${item['content']}';
      }).join('\n\n— — —\n\n')}');
    }
    return parts.join('\n\n');
  }

  await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(builder: (context, setState) {
            Future<void> send() async {
              final text = question.text.trim();
              if (text.isEmpty || sending) return;
              setState(() {
                sending = true;
                messages.add({'role': 'user', 'content': text});
                question.clear();
              });
              try {
                final answer = await store.aiCommand(text,
                    history: messages.length > 1
                        ? messages.sublist(0, messages.length - 1)
                        : const []);
                if (context.mounted)
                  setState(() => messages.add(
                      {'role': 'assistant', 'content': renderCommand(answer)}));
              } catch (e) {
                if (context.mounted)
                  setState(() => messages.add({
                        'role': 'assistant',
                        'content': 'Unable to answer: $e'
                      }));
              }
              if (context.mounted) setState(() => sending = false);
            }

            return Padding(
                padding: EdgeInsets.fromLTRB(
                    16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
                child: SizedBox(
                    height: MediaQuery.sizeOf(context).height * .72,
                    child: Column(children: [
                      Text('AI command center',
                          style: Theme.of(context).textTheme.titleLarge),
                      const Text(
                          'Live organization data • asks when details are missing • review before action'),
                      const SizedBox(height: 8),
                      Expanded(
                          child: ListView(
                              children: messages
                                  .map((m) => Align(
                                      alignment: m['role'] == 'user'
                                          ? Alignment.centerRight
                                          : Alignment.centerLeft,
                                      child: Card(
                                          child: Padding(
                                              padding: const EdgeInsets.all(12),
                                              child: SelectableText(
                                                  m['content']!)))))
                                  .toList())),
                      Row(children: [
                        Expanded(
                            child: TextField(
                                controller: question,
                                maxLength: 500,
                                decoration: const InputDecoration(
                                    labelText: 'Question'),
                                onSubmitted: (_) => send())),
                        const SizedBox(width: 8),
                        IconButton.filled(
                            onPressed: sending ? null : send,
                            icon: sending
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.send))
                      ]),
                    ])));
          }));
  question.dispose();
}
