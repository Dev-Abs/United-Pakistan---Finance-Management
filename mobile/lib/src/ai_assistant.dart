import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'finance_store.dart';
import 'templates.dart';
import 'theme.dart';

class AiCapabilities {
  const AiCapabilities({
    required this.enabled,
    required this.controlledActionsEnabled,
    required this.privacyNote,
  });
  final bool enabled;
  final bool controlledActionsEnabled;
  final String privacyNote;

  factory AiCapabilities.from(Map<String, dynamic> value) => AiCapabilities(
        enabled: value['enabled'] == true,
        controlledActionsEnabled: value['controlledActionsEnabled'] == true,
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

  Future<List<Map<String, dynamic>>> aiBulkDrafts() async {
    final response = await api.request('/api/ai/bulk-drafts',
        method: 'POST', body: {'month': month, 'language': 'bilingual'});
    final data = Map<String, dynamic>.from(
        response['data'] as Map? ?? const <String, dynamic>{});
    return (data['drafts'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
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
  const AssistantScreen({
    super.key,
    required this.store,
    this.readOnly = false,
    this.embedded = false,
  });
  final FinanceStore store;
  final bool readOnly;
  final bool embedded;

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
  Widget build(BuildContext context) {
    final content = FutureBuilder<AiCapabilities>(
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
              action: () =>
                  setState(() => capabilities = widget.store.aiCapabilities()));
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
                    onPressed: () => showAiChat(context, widget.store,
                        readOnly: widget.readOnly),
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
                      readOnly: widget.readOnly,
                      initialPrompt:
                          'Prepare a WhatsApp message for a member. Ask me which member and purpose if I have not provided them.')),
              ActionChip(
                  avatar: const Icon(Icons.groups_outlined, size: 18),
                  label: const Text('Message all members'),
                  onPressed: () => showAiChat(context, widget.store,
                      readOnly: widget.readOnly,
                      initialPrompt:
                          'Prepare a personalized WhatsApp message for all members. Ask me for the purpose and tone if needed.')),
              ActionChip(
                  avatar: const Icon(Icons.summarize_outlined, size: 18),
                  label: const Text('Prepare report'),
                  onPressed: () => showAiChat(context, widget.store,
                      readOnly: widget.readOnly,
                      initialPrompt:
                          'Prepare a management report for the selected month using all relevant live data.')),
              ActionChip(
                  avatar: const Icon(Icons.edit_note, size: 18),
                  label: const Text('Record finance entry'),
                  onPressed: widget.readOnly
                      ? null
                      : () => showAiEntryAssistant(context, widget.store)),
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
                      decoration: const InputDecoration(labelText: 'Language'),
                      items: const [
                        DropdownMenuItem(
                            value: 'bilingual', child: Text('Urdu + English')),
                        DropdownMenuItem(value: 'urdu', child: Text('Urdu')),
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
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
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
                  enabled: !widget.readOnly,
                  onTap: widget.readOnly
                      ? null
                      : () => showAiEntryAssistant(context, widget.store),
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
                  onTap: () => showAiChat(context, widget.store,
                      readOnly: widget.readOnly),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.groups_outlined),
                  title: const Text('Bulk reminder drafts'),
                  subtitle: Text(value.controlledActionsEnabled
                      ? 'Prepare overdue-member drafts; review and open each one manually.'
                      : 'Available when controlled AI actions are enabled by an administrator.'),
                  trailing: value.controlledActionsEnabled && !widget.readOnly
                      ? const Icon(Icons.chevron_right)
                      : const Icon(Icons.lock_outline),
                  enabled: value.controlledActionsEnabled && !widget.readOnly,
                  onTap: value.controlledActionsEnabled && !widget.readOnly
                      ? () => showAiBulkDrafts(context, widget.store)
                      : null,
                ),
              ]),
            ),
            const SizedBox(height: AppSpace.lg),
            _PrivacyCard(note: value.privacyNote),
          ],
        );
      },
    );
    if (widget.embedded) return content;
    return Scaffold(
      appBar: AppBar(title: const Text('Management assistant')),
      body: GradientCanvas(child: content),
    );
  }
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
    requestFocus: true,
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
    requestFocus: true,
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
    requestFocus: true,
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
      requestFocus: true,
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
    {String? initialPrompt, bool readOnly = false}) async {
  final question = TextEditingController(text: initialPrompt ?? '');
  final messages = <Map<String, dynamic>>[];
  final states = <String, String>{};
  var sending = false;
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
                final history = messages
                    .take(messages.length - 1)
                    .map((item) => {
                          'role': item['role']?.toString() ?? 'user',
                          'content': item['content']?.toString() ?? '',
                        })
                    .toList()
                    .takeLast(6);
                final command = await store.aiCommand(text, history: history);
                if (context.mounted) {
                  setState(() => messages.add({
                        'role': 'assistant',
                        'content': command['answer']?.toString() ?? '',
                        'command': command,
                      }));
                }
              } catch (error) {
                if (context.mounted) {
                  setState(() => messages.add({
                        'role': 'assistant',
                        'content': 'Unable to answer: $error',
                      }));
                }
              } finally {
                if (context.mounted) setState(() => sending = false);
              }
            }

            return Padding(
                padding: EdgeInsets.fromLTRB(
                    16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
                child: SizedBox(
                    height: MediaQuery.sizeOf(context).height * .76,
                    child: Column(children: [
                      Text('AI command center',
                          style: Theme.of(context).textTheme.titleLarge),
                      const Text(
                          'Live data • explicit review • no automatic sends'),
                      const SizedBox(height: 8),
                      Expanded(
                          child: ListView.builder(
                              itemCount: messages.length,
                              itemBuilder: (context, index) {
                                final message = messages[index];
                                if (message['role'] == 'user') {
                                  return Align(
                                      alignment: Alignment.centerRight,
                                      child: Card(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primaryContainer,
                                          child: Padding(
                                              padding: const EdgeInsets.all(12),
                                              child: SelectableText(
                                                  message['content']
                                                          ?.toString() ??
                                                      ''))));
                                }
                                final command = Map<String, dynamic>.from(
                                    message['command'] as Map? ?? const {});
                                if (command.isEmpty) {
                                  return _AssistantBubble(
                                      text:
                                          message['content']?.toString() ?? '');
                                }
                                return _CommandCard(
                                  command: command,
                                  states: states,
                                  messageIndex: index,
                                  readOnly: readOnly,
                                  onRun: (actionIndex, action) async {
                                    final key = '$index:$actionIndex';
                                    setState(() => states[key] = 'busy');
                                    try {
                                      final completed = await _reviewAiAction(
                                          context, store, action,
                                          readOnly: readOnly);
                                      if (context.mounted) {
                                        setState(() => states[key] = completed
                                            ? 'completed'
                                            : 'drafted');
                                      }
                                    } catch (error) {
                                      if (context.mounted) {
                                        setState(() => states[key] = 'failed');
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(SnackBar(
                                                content:
                                                    Text(error.toString())));
                                      }
                                    }
                                  },
                                  onDraft: (draftIndex, draft) async {
                                    final key = '$index:d$draftIndex';
                                    final rowId =
                                        number(draft['recipientRowId']).toInt();
                                    final member = store.members
                                        .where((item) =>
                                            number(item['_rowId']).toInt() ==
                                            rowId)
                                        .firstOrNull;
                                    final opened = await _reviewAiWhatsApp(
                                      context,
                                      draft['content']?.toString() ?? '',
                                      phone: member?['Phone Number'],
                                      title:
                                          'Review ${draft['recipientName'] ?? 'message'}',
                                    );
                                    if (opened && context.mounted) {
                                      setState(() =>
                                          states[key] = 'reviewed-opened');
                                    }
                                  },
                                );
                              })),
                      Row(children: [
                        Expanded(
                            child: TextField(
                                controller: question,
                                autofocus: initialPrompt == null,
                                maxLength: 500,
                                decoration: const InputDecoration(
                                    labelText: 'Ask or request an action'),
                                onSubmitted: (_) => send())),
                        const SizedBox(width: 8),
                        IconButton.filled(
                            tooltip: 'Send request',
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

class _AssistantBubble extends StatelessWidget {
  const _AssistantBubble({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Align(
      alignment: Alignment.centerLeft,
      child: Card(
          child: Padding(
              padding: const EdgeInsets.all(12),
              child: SelectableText(text, textDirection: _direction(text)))));
}

class _CommandCard extends StatelessWidget {
  const _CommandCard({
    required this.command,
    required this.states,
    required this.messageIndex,
    required this.readOnly,
    required this.onRun,
    required this.onDraft,
  });
  final Map<String, dynamic> command;
  final Map<String, String> states;
  final int messageIndex;
  final bool readOnly;
  final Future<void> Function(int, Map<String, dynamic>) onRun;
  final Future<void> Function(int, Map<String, dynamic>) onDraft;

  @override
  Widget build(BuildContext context) {
    final drafts = (command['drafts'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final actions = (command['proposedActions'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final questions = List<dynamic>.from(command['questions'] as List? ?? []);
    final plan = List<dynamic>.from(command['plan'] as List? ?? []);
    final sources = List<dynamic>.from(command['sources'] as List? ?? []);
    final answer = command['answer']?.toString() ?? '';
    return Align(
        alignment: Alignment.centerLeft,
        child: Card(
            child: Padding(
                padding: const EdgeInsets.all(AppSpace.md),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _AiStateLabel(
                          icon: Icons.check_circle_outline,
                          text: 'Answered from authorized data',
                          kind: 'answered'),
                      if (answer.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        SelectableText(answer,
                            textDirection: _direction(answer)),
                      ],
                      if (questions.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text('Details needed',
                            style: Theme.of(context).textTheme.titleSmall),
                        ...questions.map((item) => Text('• $item')),
                      ],
                      if (plan.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text('Plan',
                            style: Theme.of(context).textTheme.titleSmall),
                        ...plan.asMap().entries.map(
                            (item) => Text('${item.key + 1}. ${item.value}')),
                      ],
                      ...drafts.asMap().entries.map((entry) {
                        final state =
                            states['$messageIndex:d${entry.key}'] ?? 'drafted';
                        return Container(
                            margin: const EdgeInsets.only(top: 12),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                                color: Theme.of(context)
                                    .colorScheme
                                    .surfaceContainerLow,
                                borderRadius:
                                    BorderRadius.circular(AppRadius.md)),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _AiStateLabel(
                                      icon: state == 'reviewed-opened'
                                          ? Icons.open_in_new
                                          : Icons.edit_note,
                                      text: state == 'reviewed-opened'
                                          ? 'Reviewed — WhatsApp opened; send status unknown'
                                          : 'Drafted — review required',
                                      kind: state == 'reviewed-opened'
                                          ? 'completed'
                                          : 'drafted'),
                                  const SizedBox(height: 8),
                                  Text(
                                      entry.value['recipientName']
                                              ?.toString() ??
                                          'Prepared draft',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall),
                                  SelectableText(
                                      entry.value['content']?.toString() ?? ''),
                                  const SizedBox(height: 8),
                                  Wrap(spacing: 8, children: [
                                    OutlinedButton.icon(
                                        onPressed: () => Clipboard.setData(
                                            ClipboardData(
                                                text: entry.value['content']
                                                        ?.toString() ??
                                                    '')),
                                        icon: const Icon(Icons.copy_outlined),
                                        label: const Text('Copy')),
                                    if (entry.value['channel'] == 'whatsapp')
                                      FilledButton.icon(
                                          onPressed: () =>
                                              onDraft(entry.key, entry.value),
                                          icon: const Icon(Icons.chat_outlined),
                                          label: const Text('Review & open')),
                                  ]),
                                ]));
                      }),
                      ...actions.asMap().entries.map((entry) {
                        final state =
                            states['$messageIndex:${entry.key}'] ?? 'drafted';
                        final blocked = readOnly &&
                            _aiMutation(entry.value['type']?.toString() ?? '');
                        return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(_aiActionIcon(
                                entry.value['type']?.toString() ?? '')),
                            title: Text(entry.value['label']?.toString() ??
                                'Review action'),
                            subtitle: Text(blocked
                                ? 'Read-only — action unavailable'
                                : switch (state) {
                                    'completed' => 'Confirmed and completed',
                                    'failed' => 'Failed — review and retry',
                                    'busy' => 'Confirming…',
                                    _ => 'Drafted — confirmation required',
                                  }),
                            trailing: state == 'busy'
                                ? const SizedBox.square(
                                    dimension: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : IconButton(
                                    tooltip: 'Review action',
                                    onPressed: blocked || state == 'completed'
                                        ? null
                                        : () => onRun(entry.key, entry.value),
                                    icon: Icon(state == 'completed'
                                        ? Icons.check_circle
                                        : Icons.chevron_right)));
                      }),
                      if (sources.isNotEmpty) ...[
                        const Divider(height: 24),
                        Text('Sources: ${sources.join(' • ')}',
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ]))));
  }
}

class _AiStateLabel extends StatelessWidget {
  const _AiStateLabel(
      {required this.icon, required this.text, required this.kind});
  final IconData icon;
  final String text, kind;
  @override
  Widget build(BuildContext context) {
    final color = kind == 'completed'
        ? context.semanticColors.success
        : kind == 'drafted'
            ? context.semanticColors.warning
            : context.semanticColors.info;
    return Align(
        alignment: Alignment.centerLeft,
        child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
                color: color.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(99)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 5),
              Flexible(
                  child: Text(text,
                      style: TextStyle(
                          color: color,
                          fontSize: 11,
                          fontWeight: FontWeight.w800)))
            ])));
  }
}

bool _aiMutation(String type) => const {
      'record-payment',
      'add-expense',
      'record-contribution',
      'log-follow-up',
      'update-template',
      'update-settings',
      'create-month',
    }.contains(type);

IconData _aiActionIcon(String type) => switch (type) {
      'record-payment' => Icons.add_card,
      'add-expense' => Icons.receipt_long_outlined,
      'record-contribution' => Icons.volunteer_activism_outlined,
      'log-follow-up' => Icons.history_outlined,
      'update-template' => Icons.edit_note,
      'update-settings' => Icons.settings_outlined,
      'create-month' || 'select-month' => Icons.calendar_month_outlined,
      'open-whatsapp' => Icons.chat_outlined,
      'copy-report' => Icons.copy_all_outlined,
      _ => Icons.auto_awesome_outlined,
    };

Future<bool> _reviewAiAction(
    BuildContext context, FinanceStore store, Map<String, dynamic> action,
    {required bool readOnly}) async {
  final type = action['type']?.toString() ?? '';
  final payload = Map<String, dynamic>.from(
      action['payload'] as Map? ?? const <String, dynamic>{});
  if (readOnly && _aiMutation(type)) {
    throw const ApiException('Your account is read only.');
  }
  if (type == 'open-whatsapp') {
    return _reviewAiWhatsApp(context, payload['content']?.toString() ?? '',
        phone: payload['phone'],
        title: action['label']?.toString() ?? 'Review WhatsApp message');
  }
  final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
              icon: Icon(_aiActionIcon(type)),
              title: Text(action['label']?.toString() ?? 'Confirm action'),
              content: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 360),
                  child: SingleChildScrollView(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        const _AiStateLabel(
                            icon: Icons.edit_note,
                            text: 'AI-drafted — confirmation required',
                            kind: 'drafted'),
                        const SizedBox(height: 12),
                        ...payload.entries.map((entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 7),
                            child: SelectableText(
                                '${entry.key}: ${entry.value}'))),
                        if (_aiMutation(type))
                          const Text(
                              'The normal authorized route and server validation will still apply.'),
                      ]))),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialog, false),
                    child: const Text('Cancel')),
                FilledButton(
                    onPressed: () => Navigator.pop(dialog, true),
                    child: Text(type == 'copy-report' ? 'Copy' : 'Confirm'))
              ]));
  if (confirmed != true) return false;
  HapticFeedback.mediumImpact();
  Map<String, dynamic> memberFor(Object? rowId) => store.members.firstWhere(
      (member) => number(member['_rowId']).toInt() == number(rowId).toInt());
  final today = DateTime.now().toIso8601String().substring(0, 10);
  switch (type) {
    case 'record-payment':
      await store.recordPayment(
          memberFor(payload['memberRowId']),
          number(payload['cumulativeAmount']),
          payload['date']?.toString().isNotEmpty == true
              ? payload['date'].toString()
              : today,
          payload['remarks']?.toString() ?? '');
    case 'add-expense':
      await store.addExpense(
          date: payload['date']?.toString().isNotEmpty == true
              ? payload['date'].toString()
              : today,
          category: payload['category']?.toString() ?? 'Miscellaneous',
          description: payload['description']?.toString() ?? '',
          amount: number(payload['amount']),
          paidBy: payload['paidBy']?.toString() ?? '',
          remarks: payload['remarks']?.toString() ?? '');
    case 'record-contribution':
      final member = memberFor(payload['memberRowId']);
      await store.saveContribution({
        'Campaign ID': payload['campaignId'],
        'Member Name': member['Name'],
        'Phone Number': member['Phone Number'],
        'Member Category': member['Member Category'],
        'Amount Paid': number(payload['amount']),
        'Payment Date': payload['date']?.toString().isNotEmpty == true
            ? payload['date']
            : today,
        'Receipt Link': payload['receiptLink'] ?? '',
        'Remarks': payload['remarks'] ?? ''
      });
    case 'log-follow-up':
      await store.addFollowUp(memberFor(payload['memberRowId']), {
        'Event Type': payload['eventType'] ?? 'Reply Received',
        'Reply Status': payload['replyStatus'] ?? '',
        'Reason / Reply': payload['reason'] ?? '',
        'Next Reminder Date': payload['nextReminderDate'] ?? '',
        'Notes': payload['notes'] ?? ''
      });
    case 'update-template':
      await store
          .saveSettings({payload['settingKey'].toString(): payload['content']});
    case 'update-settings':
      await store.saveSettings(Map<String, dynamic>.from(
          payload['values'] as Map? ?? const <String, dynamic>{}));
    case 'create-month':
      await store.createMonth(
          payload['monthName'].toString(), payload['carryBalances'] != false);
    case 'select-month':
      await store.selectMonth(payload['monthName'].toString());
    case 'copy-report':
      await Clipboard.setData(
          ClipboardData(text: payload['content']?.toString() ?? ''));
    default:
      throw const ApiException('This action is not supported by the app.');
  }
  return true;
}

Future<bool> _reviewAiWhatsApp(BuildContext context, String content,
    {Object? phone, required String title}) async {
  final controller = TextEditingController(text: content);
  final approved = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
              title: Text(title),
              content: SingleChildScrollView(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                const _AiStateLabel(
                    icon: Icons.edit_note,
                    text: 'Drafted — review before opening WhatsApp',
                    kind: 'drafted'),
                const SizedBox(height: 12),
                TextField(
                    controller: controller,
                    autofocus: true,
                    minLines: 6,
                    maxLines: 14,
                    decoration: const InputDecoration(
                        labelText: 'Editable message',
                        alignLabelWithHint: true)),
                const SizedBox(height: 8),
                const Text(
                    'WhatsApp opens externally. The app cannot verify whether the message is sent.')
              ])),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialog, false),
                    child: const Text('Cancel')),
                FilledButton.icon(
                    onPressed: controller.text.trim().isEmpty
                        ? null
                        : () => Navigator.pop(dialog, true),
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('Open WhatsApp'))
              ]));
  if (approved != true) {
    controller.dispose();
    return false;
  }
  var digits = phone?.toString().replaceAll(RegExp(r'\D'), '') ?? '';
  if (digits.startsWith('0')) digits = '92${digits.substring(1)}';
  if (digits.length == 10 && digits.startsWith('3')) digits = '92$digits';
  final uri = Uri.parse(
      'https://wa.me/${digits.length >= 11 ? digits : ''}?text=${Uri.encodeComponent(controller.text.trim())}');
  final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!opened) {
    await Clipboard.setData(ClipboardData(text: controller.text.trim()));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('WhatsApp could not open. Message copied instead.')));
    }
  }
  controller.dispose();
  return opened;
}

Future<void> showAiBulkDrafts(BuildContext context, FinanceStore store) async {
  await showModalBottomSheet<void>(
      context: context,
      requestFocus: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
          child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
              child: SizedBox(
                  height: MediaQuery.sizeOf(context).height * .75,
                  child: FutureBuilder<List<Map<String, dynamic>>>(
                      future: store.aiBulkDrafts(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                              child: CircularProgressIndicator());
                        }
                        if (snapshot.hasError) {
                          return _AiCenteredState(
                              icon: Icons.cloud_off_outlined,
                              title: 'Couldn’t prepare drafts',
                              message: snapshot.error.toString());
                        }
                        final drafts = snapshot.data ?? const [];
                        return ListView(children: [
                          Text('Bulk reminder drafts',
                              style: Theme.of(context).textTheme.titleLarge),
                          const Text(
                              'Review each draft and open each conversation manually. Nothing is auto-sent.'),
                          const SizedBox(height: 12),
                          if (drafts.isEmpty)
                            const _AiCenteredState(
                                icon: Icons.task_alt,
                                title: 'No reminders needed',
                                message: 'No overdue drafts were returned.')
                          else
                            ...drafts.map((draft) => Card(
                                child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          const _AiStateLabel(
                                              icon: Icons.edit_note,
                                              text: 'Drafted — review required',
                                              kind: 'drafted'),
                                          const SizedBox(height: 8),
                                          Text(
                                              draft['name']?.toString() ??
                                                  'Member',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleMedium),
                                          SelectableText(
                                              draft['message']?.toString() ??
                                                  ''),
                                          const SizedBox(height: 8),
                                          FilledButton.icon(
                                              onPressed: () {
                                                final rowId =
                                                    number(draft['rowId']);
                                                final member = store.members
                                                    .where((item) =>
                                                        number(
                                                            item['_rowId']) ==
                                                        rowId)
                                                    .firstOrNull;
                                                _reviewAiWhatsApp(
                                                    context,
                                                    draft['message']
                                                            ?.toString() ??
                                                        '',
                                                    phone:
                                                        member?['Phone Number'],
                                                    title:
                                                        'Review ${draft['name'] ?? 'message'}');
                                              },
                                              icon: const Icon(
                                                  Icons.chat_outlined),
                                              label: const Text(
                                                  'Review & open WhatsApp'))
                                        ]))))
                        ]);
                      })))));
}

extension _RecentItems<T> on List<T> {
  List<T> takeLast(int count) =>
      length <= count ? List<T>.from(this) : sublist(length - count);
}
