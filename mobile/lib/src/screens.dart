import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:skeletonizer/skeletonizer.dart';
import 'package:toastification/toastification.dart';
import 'api_client.dart';
import 'ai_assistant.dart';
import 'finance_store.dart';
import 'parity_screens.dart';
import 'theme.dart';

typedef SignedIn = Future<void> Function(String role);

class AppLaunchScreen extends StatelessWidget {
  const AppLaunchScreen({super.key});
  @override
  Widget build(BuildContext c) => Scaffold(
          body: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
                color: Theme.of(c).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(24)),
            child: Icon(Iconsax.wallet_3,
                size: 34, color: Theme.of(c).colorScheme.primary)),
        const SizedBox(height: 20),
        Text('United Pakistan', style: Theme.of(c).textTheme.titleLarge),
        const SizedBox(height: 18),
        const SizedBox.square(
            dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
      ]).animate().fadeIn(duration: 300.ms)));
}

class LoginScreen extends StatefulWidget {
  const LoginScreen(
      {super.key, required this.client, required this.onSignedIn});
  final ApiClient client;
  final SignedIn onSignedIn;
  @override
  State<LoginScreen> createState() => _LoginState();
}

class _LoginState extends State<LoginScreen> {
  final key = GlobalKey<FormState>(),
      user = TextEditingController(),
      pass = TextEditingController();
  bool busy = false, hide = true;
  String? error;
  @override
  void dispose() {
    user.dispose();
    pass.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!(key.currentState?.validate() ?? false)) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final r = await widget.client.request('/api/auth/login',
          method: 'POST',
          body: {'username': user.text.trim(), 'password': pass.text});
      widget.client.token = r['token']?.toString();
      await widget.onSignedIn(r['role']?.toString() ?? 'admin');
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
      body: SafeArea(
          child: Center(
              child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: Form(
                          key: key,
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Container(
                                        width: 72,
                                        height: 72,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                            color: Theme.of(c)
                                                .colorScheme
                                                .primaryContainer,
                                            borderRadius:
                                                BorderRadius.circular(24)),
                                        child: const Icon(Iconsax.wallet_3,
                                            size: 34, color: AppColors.emerald))
                                    .animate()
                                    .fadeIn()
                                    .scale(),
                                const SizedBox(height: 20),
                                Text('United Pakistan',
                                    textAlign: TextAlign.center,
                                    style:
                                        Theme.of(c).textTheme.headlineMedium),
                                const Text('Finance, clear and accountable.',
                                    textAlign: TextAlign.center),
                                const SizedBox(height: 32),
                                Card(
                                        child: Padding(
                                            padding: const EdgeInsets.all(24),
                                            child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.stretch,
                                                children: [
                                                  Text('Welcome back',
                                                      style: Theme.of(c)
                                                          .textTheme
                                                          .titleLarge),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                      'Sign in to securely manage your organization’s finances.',
                                                      style: Theme.of(c)
                                                          .textTheme
                                                          .bodyMedium
                                                          ?.copyWith(
                                                              color: Theme.of(c)
                                                                  .colorScheme
                                                                  .onSurfaceVariant)),
                                                  const SizedBox(height: 18),
                                                  TextFormField(
                                                      controller: user,
                                                      autofillHints: const [
                                                        AutofillHints.username
                                                      ],
                                                      textInputAction:
                                                          TextInputAction.next,
                                                      decoration: const InputDecoration(
                                                          labelText: 'Username',
                                                          prefixIcon: Icon(Icons
                                                              .person_outline)),
                                                      validator: (v) => v ==
                                                                  null ||
                                                              v.trim().isEmpty
                                                          ? 'Username is required'
                                                          : null),
                                                  const SizedBox(height: 12),
                                                  TextFormField(
                                                      controller: pass,
                                                      obscureText: hide,
                                                      autofillHints: const [
                                                        AutofillHints.password
                                                      ],
                                                      onFieldSubmitted: (_) =>
                                                          submit(),
                                                      decoration: InputDecoration(
                                                          labelText: 'Password',
                                                          prefixIcon:
                                                              const Icon(Icons
                                                                  .lock_outline),
                                                          suffixIcon: IconButton(
                                                              onPressed: () =>
                                                                  setState(() =>
                                                                      hide =
                                                                          !hide),
                                                              icon: Icon(hide
                                                                  ? Icons
                                                                      .visibility_outlined
                                                                  : Icons
                                                                      .visibility_off_outlined))),
                                                      validator: (v) => v ==
                                                                  null ||
                                                              v.isEmpty
                                                          ? 'Password is required'
                                                          : null),
                                                  if (error != null)
                                                    Semantics(
                                                        liveRegion: true,
                                                        child: Container(
                                                            margin:
                                                                const EdgeInsets
                                                                    .only(
                                                                    top: 12),
                                                            padding:
                                                                const EdgeInsets
                                                                    .all(12),
                                                            decoration: BoxDecoration(
                                                                color: Theme.of(
                                                                        c)
                                                                    .colorScheme
                                                                    .errorContainer,
                                                                borderRadius:
                                                                    BorderRadius
                                                                        .circular(
                                                                            12)),
                                                            child:
                                                                Row(children: [
                                                              Icon(
                                                                  Icons
                                                                      .error_outline,
                                                                  color: Theme
                                                                          .of(c)
                                                                      .colorScheme
                                                                      .onErrorContainer),
                                                              const SizedBox(
                                                                  width: 10),
                                                              Expanded(
                                                                  child: Text(
                                                                      error!))
                                                            ]))),
                                                  const SizedBox(height: 18),
                                                  FilledButton(
                                                      onPressed:
                                                          busy ? null : submit,
                                                      child: busy
                                                          ? const SizedBox
                                                              .square(
                                                              dimension: 22,
                                                              child: CircularProgressIndicator(
                                                                  strokeWidth:
                                                                      2,
                                                                  color: Colors
                                                                      .white))
                                                          : const Text(
                                                              'Sign in'))
                                                ])))
                                    .animate()
                                    .fadeIn(delay: 100.ms)
                                    .slideY(begin: .04)
                              ])))))));
}

class AppShell extends StatefulWidget {
  const AppShell(
      {super.key,
      required this.client,
      required this.readOnly,
      required this.onSignOut,
      required this.themeMode,
      required this.onThemeModeChanged});
  final ApiClient client;
  final bool readOnly;
  final VoidCallback onSignOut;
  final String themeMode;
  final ValueChanged<String> onThemeModeChanged;
  @override
  State<AppShell> createState() => _ShellState();
}

class _ShellState extends State<AppShell> {
  late final FinanceStore store;
  int tab = 0;
  @override
  void initState() {
    super.initState();
    store = FinanceStore(widget.client)..addListener(changed);
    store.initialize();
  }

  void changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    store.removeListener(changed);
    store.dispose();
    super.dispose();
  }

  void toast(String m, {bool bad = false}) => toastification.show(
      context: context,
      type: bad ? ToastificationType.error : ToastificationType.success,
      title: Text(m),
      autoCloseDuration: const Duration(seconds: 3));
  Future<void> chooseMonth() async {
    final v = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (c) => SafeArea(
                child: ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.only(bottom: 12),
                    children: [
                  ListTile(
                      title: Text('Reporting month',
                          style: Theme.of(c).textTheme.titleLarge),
                      subtitle: const Text(
                          'All figures update to the selected period.')),
                  RadioGroup<String>(
                      groupValue: store.month,
                      onChanged: (value) => Navigator.pop(c, value),
                      child: Column(
                          children: store.months
                              .map((m) => RadioListTile<String>(
                                  value: m, title: Text(m)))
                              .toList()))
                ])));
    if (v != null) await store.selectMonth(v);
  }

  Future<void> payment([Map<String, dynamic>? m]) async {
    if (widget.readOnly) return toast('Your account is read only', bad: true);
    if (store.members.isEmpty) {
      return toast('No members in this month', bad: true);
    }
    final ok = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => PaymentSheet(store: store, initial: m));
    if (ok == true) toast('Payment saved');
  }

  Future<void> expense() async {
    if (widget.readOnly) return toast('Your account is read only', bad: true);
    final ok = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => ExpenseSheet(store: store));
    if (ok == true) toast('Expense saved');
  }

  @override
  Widget build(BuildContext c) {
    final pages = [
      Dashboard(store: store, readOnly: widget.readOnly, pay: payment),
      Members(store: store, readOnly: widget.readOnly, pay: payment),
      Activity(store: store, readOnly: widget.readOnly, add: expense),
      More(
          store: store,
          readOnly: widget.readOnly,
          signOut: widget.onSignOut,
          themeMode: widget.themeMode,
          onThemeModeChanged: widget.onThemeModeChanged)
    ];
    return Scaffold(
        appBar: AppBar(
            title: Row(children: [
              Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                      color: Theme.of(c).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(11)),
                  child: Icon(Iconsax.wallet_3,
                      size: 18, color: Theme.of(c).colorScheme.primary)),
              const SizedBox(width: 10),
              const Text('United Pakistan')
            ]),
            actions: [
              if (widget.readOnly)
                const Padding(
                    padding: EdgeInsets.only(right: 4),
                    child: Chip(
                        avatar: Icon(Icons.lock_outline, size: 15),
                        label: Text('Read only'))),
              IconButton(
                  tooltip: 'Search members',
                  onPressed: () => showSearch(
                      context: c,
                      delegate: MemberSearch(store, widget.readOnly, payment)),
                  icon: const Icon(Icons.search))
            ]),
        body: Column(children: [
          Material(
              color: Theme.of(c).colorScheme.surface,
              child: InkWell(
                  onTap: store.months.isEmpty ? null : chooseMonth,
                  child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 11),
                      child: Row(children: [
                        const Icon(Icons.calendar_month_outlined,
                            color: AppColors.emerald),
                        const SizedBox(width: 9),
                        Expanded(
                            child: Text(store.month ?? 'No reporting month',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800))),
                        if (store.refreshing)
                          const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2))
                        else
                          const Icon(Icons.expand_more)
                      ])))),
          if (store.refreshError != null)
            MaterialBanner(
                content: Text('Showing saved data. ${store.refreshError}',
                    maxLines: 2, overflow: TextOverflow.ellipsis),
                actions: [
                  TextButton(
                      onPressed: store.refresh, child: const Text('Try again'))
                ]),
          Expanded(
              child: store.loading
                  ? const LoadingState()
                  : store.error != null
                      ? ErrorState(
                          message: store.error!, retry: store.initialize)
                      : store.month == null
                          ? const EmptyState(
                              icon: Icons.calendar_month,
                              title: 'No reporting months',
                              message: 'Create a month in web admin to begin.')
                          : AnimatedSwitcher(
                              duration: const Duration(milliseconds: 220),
                              switchInCurve: Curves.easeOutCubic,
                              switchOutCurve: Curves.easeInCubic,
                              child: KeyedSubtree(
                                  key: ValueKey(tab), child: pages[tab])))
        ]),
        bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: (v) {
              HapticFeedback.selectionClick();
              setState(() => tab = v);
            },
            destinations: const [
              NavigationDestination(
                  icon: Icon(Iconsax.home_2_copy),
                  selectedIcon: Icon(Iconsax.home_2),
                  label: 'Overview'),
              NavigationDestination(
                  icon: Icon(Iconsax.people_copy),
                  selectedIcon: Icon(Iconsax.people),
                  label: 'Members'),
              NavigationDestination(
                  icon: Icon(Iconsax.receipt_2_1_copy),
                  selectedIcon: Icon(Iconsax.receipt_2_1),
                  label: 'Activity'),
              NavigationDestination(
                  icon: Icon(Iconsax.more_copy),
                  selectedIcon: Icon(Iconsax.more),
                  label: 'More')
            ]));
  }
}

class Dashboard extends StatelessWidget {
  const Dashboard(
      {super.key,
      required this.store,
      required this.readOnly,
      required this.pay});
  final FinanceStore store;
  final bool readOnly;
  final void Function([Map<String, dynamic>?]) pay;
  @override
  Widget build(BuildContext c) {
    final due = store.members
        .where((m) => number(m['Remaining Balance']) > 0)
        .toList()
      ..sort((a, b) => number(b['Remaining Balance'])
          .compareTo(number(a['Remaining Balance'])));
    return RefreshIndicator(
        onRefresh: store.refresh,
        child: PageFrame(children: [
          Text('Financial overview',
              style: Theme.of(c).textTheme.headlineMedium),
          Text('${store.members.length} members • ${store.month}',
              style:
                  TextStyle(color: Theme.of(c).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 18),
          Card(
              child: ListTile(
                  leading: Icon(Icons.auto_awesome,
                      color: Theme.of(c).colorScheme.primary),
                  title: const Text('AI management briefing'),
                  subtitle: const Text(
                      'Turn verified finance totals into priorities and insights'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                      c,
                      MaterialPageRoute(
                          builder: (_) => AssistantScreen(store: store))))),
          const SizedBox(height: 12),
          LayoutBuilder(builder: (_, x) {
            final w = (x.maxWidth - 12) / 2;
            return Wrap(spacing: 12, runSpacing: 12, children: [
              Metric(
                  w: w,
                  label: 'Collected',
                  value: money(store.collected),
                  icon: Icons.south_west,
                  color: AppColors.success),
              Metric(
                  w: w,
                  label: 'Outstanding',
                  value: money(store.outstanding),
                  icon: Icons.schedule,
                  color: AppColors.warning),
              Metric(
                  w: w,
                  label: 'Expenses',
                  value: money(store.spent),
                  icon: Icons.north_east,
                  color: AppColors.error),
              Metric(
                  w: w,
                  label: 'Cash balance',
                  value: money(store.balance),
                  icon: Icons.account_balance_wallet_outlined,
                  color: AppColors.emerald)
            ]);
          }),
          const SizedBox(height: 18),
          CashFlowCard(store: store),
          if (!readOnly) ...[
            const SizedBox(height: 14),
            FilledButton.icon(
                onPressed: pay,
                icon: const Icon(Icons.add_card),
                label: const Text('Record payment')),
          ],
          const SizedBox(height: 24),
          SectionHeader(title: 'Needs attention', action: '${due.length} open'),
          if (due.isEmpty)
            const EmptyState(
                icon: Icons.task_alt,
                title: 'Everything is settled',
                message: 'No outstanding balances.')
          else
            ...due.take(5).map((m) => MemberTile(
                member: m,
                onTap: () => showMember(c, store, m, readOnly, pay))),
          const SizedBox(height: 24),
          const SectionHeader(title: 'Recent activity'),
          if (recent(store).isEmpty)
            const EmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No activity yet',
                message: 'Payments and expenses will appear here.')
          else
            ...recent(store).take(6).map((r) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                    backgroundColor:
                        (r.$4 < 0 ? AppColors.error : AppColors.success)
                            .withValues(alpha: .12),
                    child: Icon(r.$3,
                        size: 19,
                        color: r.$4 < 0 ? AppColors.error : AppColors.success)),
                title: Text(r.$1),
                subtitle: Text(r.$2),
                trailing: Text(money(r.$4),
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color:
                            r.$4 < 0 ? AppColors.error : AppColors.success))))
        ]));
  }
}

class CashFlowCard extends StatelessWidget {
  const CashFlowCard({super.key, required this.store});
  final FinanceStore store;

  @override
  Widget build(BuildContext context) {
    final max = [store.collected, store.spent, store.outstanding]
        .fold<double>(1, (value, item) => item > value ? item : value);
    final colors = [AppColors.success, AppColors.error, AppColors.warning];
    final values = [store.collected, store.spent, store.outstanding];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Cash flow',
                          style: Theme.of(context).textTheme.titleMedium),
                      Text('Collected, spent and still due',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                Icon(Iconsax.chart_2,
                    color: Theme.of(context).colorScheme.primary),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 132,
              child: BarChart(
                BarChartData(
                  maxY: max * 1.18,
                  alignment: BarChartAlignment.spaceAround,
                  borderData: FlBorderData(show: false),
                  gridData: const FlGridData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) => Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            const ['In', 'Out', 'Due'][value.toInt()],
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ),
                      ),
                    ),
                  ),
                  barGroups: List.generate(
                    3,
                    (index) => BarChartGroupData(
                      x: index,
                      barRods: [
                        BarChartRodData(
                          toY: values[index],
                          width: 26,
                          color: colors[index],
                          borderRadius: BorderRadius.circular(7),
                          backDrawRodData: BackgroundBarChartRodData(
                            show: true,
                            toY: max * 1.18,
                            color: colors[index].withValues(alpha: .08),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class Members extends StatefulWidget {
  const Members(
      {super.key,
      required this.store,
      required this.readOnly,
      required this.pay});
  final FinanceStore store;
  final bool readOnly;
  final void Function([Map<String, dynamic>?]) pay;
  @override
  State<Members> createState() => _MembersState();
}

class _MembersState extends State<Members> {
  String query = '', filter = 'All';
  @override
  Widget build(BuildContext c) {
    final list = widget.store.members.where((m) {
      final match = '${m['Name']} ${m['Phone Number']}'
          .toLowerCase()
          .contains(query.toLowerCase());
      return match && (filter == 'All' || m['Payment Status'] == filter);
    }).toList();
    return RefreshIndicator(
        onRefresh: widget.store.refresh,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text('Members', style: Theme.of(c).textTheme.headlineMedium),
          if (!widget.readOnly) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
                onPressed: () => showMemberEditor(c, widget.store),
                icon: const Icon(Icons.person_add_alt_1),
                label: const Text('Add member')),
          ],
          const SizedBox(height: 12),
          TextField(
              onChanged: (v) => setState(() => query = v),
              decoration: const InputDecoration(
                  hintText: 'Search name or phone',
                  prefixIcon: Icon(Icons.search))),
          const SizedBox(height: 12),
          SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                  children: ['All', 'Paid', 'Partially Paid', 'Pending']
                      .map((f) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                              label: Text(f),
                              selected: filter == f,
                              onSelected: (_) => setState(() => filter = f))))
                      .toList())),
          Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                  '${list.length} of ${widget.store.members.length} members')),
          if (list.isEmpty)
            const EmptyState(
                icon: Icons.person_search,
                title: 'No members found',
                message: 'Try another search or filter.')
          else
            ...list.map((m) => MemberTile(
                member: m,
                onTap: () => showMember(
                    c, widget.store, m, widget.readOnly, widget.pay)))
        ]));
  }
}

class Activity extends StatefulWidget {
  const Activity(
      {super.key,
      required this.store,
      required this.readOnly,
      required this.add});
  final FinanceStore store;
  final bool readOnly;
  final VoidCallback add;
  @override
  State<Activity> createState() => _ActivityState();
}

class _ActivityState extends State<Activity> {
  int segment = 0;
  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final payments =
        store.members.where((m) => number(m['Amount Paid']) > 0).toList();
    final items = switch (segment) {
      0 => payments,
      1 => store.expenses,
      _ => store.contributions,
    };
    return RefreshIndicator(
        onRefresh: store.refresh,
        child: PageFrame(children: [
          Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('Activity',
                      style: Theme.of(context).textTheme.headlineMedium),
                  Text(
                      '${payments.length + store.expenses.length + store.contributions.length} ledger entries'),
                ])),
            FilledButton.icon(
                onPressed: widget.readOnly ? null : widget.add,
                icon: const Icon(Icons.add),
                label: const Text('Expense')),
          ]),
          const SizedBox(height: 18),
          SegmentedButton<int>(
              segments: const [
                ButtonSegment(
                    value: 0,
                    label: Text('Payments'),
                    icon: Icon(Icons.south_west)),
                ButtonSegment(
                    value: 1,
                    label: Text('Expenses'),
                    icon: Icon(Icons.north_east)),
                ButtonSegment(
                    value: 2,
                    label: Text('Fund'),
                    icon: Icon(Icons.volunteer_activism_outlined)),
              ],
              selected: {
                segment
              },
              showSelectedIcon: false,
              onSelectionChanged: (v) => setState(() => segment = v.first)),
          const SizedBox(height: 18),
          if (items.isEmpty)
            EmptyState(
                icon: segment == 2
                    ? Icons.volunteer_activism_outlined
                    : Icons.receipt_long,
                title: 'No ${const [
                  'payments',
                  'expenses',
                  'contributions'
                ][segment]}',
                message: 'Entries for this reporting period appear here.')
          else if (segment == 0)
            ...payments.map((m) => LedgerTile(
                icon: Icons.south_west,
                positive: true,
                title: m['Name']?.toString() ?? 'Member payment',
                subtitle: m['Payment Date']?.toString() ?? 'Payment received',
                amount: number(m['Amount Paid'])))
          else if (segment == 1)
            ...store.expenses.map((e) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading:
                        const CircleAvatar(child: Icon(Icons.receipt_long)),
                    title: Text(e['Description']?.toString().isNotEmpty == true
                        ? e['Description'].toString()
                        : 'Expense'),
                    subtitle: Text(
                        '${e['Category'] ?? 'Uncategorized'} • ${e['Date'] ?? ''}\nPaid by ${e['Paid By'] ?? '—'}'),
                    isThreeLine: true,
                    trailing: Text(money(-number(e['Amount'])),
                        style: const TextStyle(
                            color: AppColors.error,
                            fontWeight: FontWeight.w800)),
                  ),
                ))
          else
            ...store.contributions.map((e) => LedgerTile(
                icon: Icons.volunteer_activism_outlined,
                positive: true,
                title: e['Name']?.toString() ??
                    e['Member Name']?.toString() ??
                    'Contribution',
                subtitle: e['Date']?.toString() ?? 'Special fund',
                amount: number(e['Amount Paid']))),
        ]));
  }
}

class LedgerTile extends StatelessWidget {
  const LedgerTile(
      {super.key,
      required this.icon,
      required this.positive,
      required this.title,
      required this.subtitle,
      required this.amount});
  final IconData icon;
  final bool positive;
  final String title, subtitle;
  final double amount;
  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
          leading: CircleAvatar(
              backgroundColor: (positive ? AppColors.success : AppColors.error)
                  .withValues(alpha: .12),
              child: Icon(icon,
                  size: 19,
                  color: positive ? AppColors.success : AppColors.error)),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: Text(money(positive ? amount : -amount),
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: positive ? AppColors.success : AppColors.error))));
}

class More extends StatelessWidget {
  const More(
      {super.key,
      required this.store,
      required this.readOnly,
      required this.signOut,
      required this.themeMode,
      required this.onThemeModeChanged});
  final FinanceStore store;
  final bool readOnly;
  final VoidCallback signOut;
  final String themeMode;
  final ValueChanged<String> onThemeModeChanged;
  @override
  Widget build(BuildContext c) {
    final fund = store.contributions
        .fold<double>(0, (s, e) => s + number(e['Amount Paid']));
    return PageFrame(children: [
      Text('More', style: Theme.of(c).textTheme.headlineMedium),
      const SizedBox(height: 16),
      Card(
          child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                        store.settings['ORG_NAME']?.toString() ??
                            'United Pakistan',
                        style: Theme.of(c).textTheme.titleLarge),
                    Text(
                        '${store.settings['SECTOR_NAME'] ?? ''}${readOnly ? ' • Read-only' : ' • Administrator'}')
                  ]))),
      const SizedBox(height: 12),
      Card(
          child: ListTile(
        leading: const Icon(Icons.contrast_outlined),
        title: const Text('Appearance'),
        subtitle: Text(
            '${themeMode[0].toUpperCase()}${themeMode.substring(1)} theme'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () async {
          final selected = await showModalBottomSheet<String>(
              context: c,
              showDragHandle: true,
              builder: (sheet) => SafeArea(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                    ListTile(
                        title: Text('Appearance',
                            style: Theme.of(sheet).textTheme.titleLarge)),
                    for (final mode in const ['system', 'light', 'dark'])
                      RadioListTile<String>(
                          value: mode,
                          groupValue: themeMode,
                          title: Text(
                              '${mode[0].toUpperCase()}${mode.substring(1)}'),
                          onChanged: (v) => Navigator.pop(sheet, v)),
                  ])));
          if (selected != null) onThemeModeChanged(selected);
        },
      )),
      const SizedBox(height: 12),
      Card(
          child: ListTile(
              onTap: () => Navigator.push(
                  c,
                  MaterialPageRoute(
                      builder: (_) =>
                          SpecialFundScreen(store: store, readOnly: readOnly))),
              leading: const Icon(Icons.volunteer_activism_outlined),
              title: Text(
                  store.settings['SPECIAL_FUND_CAMPAIGN_NAME']?.toString() ??
                      'Special fund'),
              subtitle: Text('${store.contributions.length} contributions'),
              trailing: Text(money(fund),
                  style: const TextStyle(fontWeight: FontWeight.w800)))),
      const SizedBox(height: 12),
      Card(
          child: Column(children: [
        ListTile(
            onTap: () => Navigator.push(
                c,
                MaterialPageRoute(
                    builder: (_) => AssistantScreen(store: store))),
            leading: const Icon(Icons.auto_awesome_outlined),
            title: const Text('Management assistant'),
            subtitle:
                const Text('Briefings, report narratives and smart drafts'),
            trailing: const Icon(Icons.chevron_right)),
        ListTile(
            onTap: () => Navigator.push(c,
                MaterialPageRoute(builder: (_) => ReportsScreen(store: store))),
            leading: const Icon(Icons.bar_chart),
            title: const Text('Report summary'),
            subtitle: Text(
                'Collected ${money(store.collected)} • Spent ${money(store.spent)}'),
            trailing: const Icon(Icons.chevron_right)),
        ListTile(
            onTap: () => Navigator.push(
                c,
                MaterialPageRoute(
                    builder: (_) =>
                        SettingsScreen(store: store, readOnly: readOnly))),
            leading: const Icon(Icons.settings_outlined),
            title: const Text('Settings & templates'),
            subtitle:
                const Text('Organization, WhatsApp, months and diagnostics'),
            trailing: const Icon(Icons.chevron_right)),
        ListTile(
            leading: const Icon(Icons.health_and_safety_outlined),
            title: const Text('Connection'),
            subtitle: Text(store.api.baseUrl),
            trailing: const Icon(Icons.check_circle, color: AppColors.success)),
        ListTile(
            leading: const Icon(Icons.payments_outlined),
            title: const Text('Default monthly fund'),
            trailing:
                Text(money(number(store.settings['DEFAULT_MONTHLY_FUND']))))
      ])),
      const SizedBox(height: 18),
      OutlinedButton.icon(
          onPressed: () async {
            final confirmed = await showDialog<bool>(
                context: c,
                builder: (context) => AlertDialog(
                        icon: const Icon(Icons.logout),
                        title: const Text('Sign out?'),
                        content: const Text(
                            'You’ll need your credentials to access finance data again.'),
                        actions: [
                          TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Cancel')),
                          FilledButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Sign out'))
                        ]));
            if (confirmed == true) signOut();
          },
          icon: const Icon(Icons.logout),
          label: const Text('Sign out'))
    ]);
  }
}

class PaymentSheet extends StatefulWidget {
  const PaymentSheet({super.key, required this.store, this.initial});
  final FinanceStore store;
  final Map<String, dynamic>? initial;
  @override
  State<PaymentSheet> createState() => _PaymentState();
}

class _PaymentState extends State<PaymentSheet> {
  final key = GlobalKey<FormState>(),
      amount = TextEditingController(),
      remarks = TextEditingController();
  Map<String, dynamic>? member;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    member = widget.initial;
    if (member != null) {
      amount.text = number(member!['Amount Paid']).toStringAsFixed(0);
    }
  }

  @override
  void dispose() {
    amount.dispose();
    remarks.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!(key.currentState?.validate() ?? false) || member == null) return;
    setState(() => busy = true);
    try {
      await widget.store.recordPayment(member!, double.parse(amount.text),
          iso(DateTime.now()), remarks.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        showError(context, e);
      }
    }
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
                Text('Record payment', style: Theme.of(c).textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                    'Update the member’s cumulative paid amount for ${widget.store.month}.',
                    style: Theme.of(c).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(c).colorScheme.onSurfaceVariant)),
                const SizedBox(height: 16),
                DropdownButtonFormField<Map<String, dynamic>>(
                    initialValue: member,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Member'),
                    items: widget.store.members
                        .map((m) => DropdownMenuItem(
                            value: m,
                            child: Text(m['Name']?.toString() ?? 'Member')))
                        .toList(),
                    onChanged: (v) => setState(() {
                          HapticFeedback.selectionClick();
                          member = v;
                          amount.text =
                              number(v?['Amount Paid']).toStringAsFixed(0);
                        }),
                    validator: (v) => v == null ? 'Select a member' : null),
                const SizedBox(height: 12),
                TextFormField(
                    controller: amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Total paid to date', prefixText: 'Rs '),
                    validator: (v) {
                      final n = double.tryParse(v ?? '');
                      if (n == null || n < 0) return 'Enter a valid amount';
                      if (member != null &&
                          n > number(member!['Total Payable'])) {
                        return 'Cannot exceed total payable';
                      }
                      return null;
                    }),
                if (member != null) ...[
                  const SizedBox(height: 8),
                  Text(
                      'Payable ${money(number(member!['Total Payable']))} • Current ${money(number(member!['Amount Paid']))}',
                      style: Theme.of(c).textTheme.bodySmall),
                ],
                const SizedBox(height: 12),
                TextFormField(
                    controller: remarks,
                    decoration:
                        const InputDecoration(labelText: 'Remarks (optional)')),
                const SizedBox(height: 18),
                FilledButton(
                    onPressed: busy ? null : save,
                    child: busy
                        ? const SizedBox.square(
                            dimension: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Confirm payment'))
              ]))));
}

class ExpenseSheet extends StatefulWidget {
  const ExpenseSheet({super.key, required this.store});
  final FinanceStore store;
  @override
  State<ExpenseSheet> createState() => _ExpenseState();
}

class _ExpenseState extends State<ExpenseSheet> {
  final key = GlobalKey<FormState>(),
      desc = TextEditingController(),
      amount = TextEditingController(),
      payer = TextEditingController(),
      remarks = TextEditingController();
  String category = 'Operations';
  bool busy = false;
  @override
  void dispose() {
    desc.dispose();
    amount.dispose();
    payer.dispose();
    remarks.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!(key.currentState?.validate() ?? false)) return;
    setState(() => busy = true);
    try {
      await widget.store.addExpense(
          date: iso(DateTime.now()),
          category: category,
          description: desc.text.trim(),
          amount: double.parse(amount.text),
          paidBy: payer.text.trim(),
          remarks: remarks.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        showError(context, e);
      }
    }
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
                Text('Add expense', style: Theme.of(c).textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                    'Record a clear, auditable expense for ${widget.store.month}.',
                    style: Theme.of(c).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(c).colorScheme.onSurfaceVariant)),
                const SizedBox(height: 16),
                DropdownButtonFormField(
                    initialValue: category,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: [
                      'Operations',
                      'Travel',
                      'Events',
                      'Printing',
                      'Miscellaneous'
                    ]
                        .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                        .toList(),
                    onChanged: (v) => setState(() => category = v!)),
                const SizedBox(height: 12),
                TextFormField(
                    controller: desc,
                    decoration: const InputDecoration(labelText: 'Description'),
                    validator: requiredText),
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
                    controller: payer,
                    decoration: const InputDecoration(labelText: 'Paid by'),
                    validator: requiredText),
                const SizedBox(height: 12),
                TextFormField(
                    controller: remarks,
                    decoration:
                        const InputDecoration(labelText: 'Remarks (optional)')),
                const SizedBox(height: 18),
                FilledButton(
                    onPressed: busy ? null : save,
                    child: busy
                        ? const SizedBox.square(
                            dimension: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Save expense'))
              ]))));
}

class MemberTile extends StatelessWidget {
  const MemberTile({super.key, required this.member, required this.onTap});
  final Map<String, dynamic> member;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) {
    final name = member['Name']?.toString() ?? 'Member';
    return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: ListTile(
            onTap: onTap,
            leading: CircleAvatar(
                child: Text(name.isEmpty ? '?' : name[0].toUpperCase())),
            title: Text(name),
            subtitle: Text(member['Phone Number']?.toString() ?? 'No phone'),
            trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(money(number(member['Remaining Balance'])),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  StatusPill(
                      status: member['Payment Status']?.toString() ?? 'Pending')
                ])));
  }
}

class Metric extends StatelessWidget {
  const Metric(
      {super.key,
      required this.w,
      required this.label,
      required this.value,
      required this.icon,
      required this.color});
  final double w;
  final String label, value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext c) => SizedBox(
      width: w,
      child: Card(
          child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, color: color),
                    const SizedBox(height: 14),
                    FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(value,
                            style: Theme.of(c).textTheme.titleLarge)),
                    const SizedBox(height: 2),
                    Text(label, style: Theme.of(c).textTheme.bodySmall)
                  ]))));
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(99)),
        child: Text(status,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: color)));
  }
}

class PageFrame extends StatelessWidget {
  const PageFrame({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => ListView(
          physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics()),
          padding: EdgeInsets.fromLTRB(
              MediaQuery.sizeOf(context).width >= 700 ? 32 : 16,
              18,
              MediaQuery.sizeOf(context).width >= 700 ? 32 : 16,
              32),
          children: [
            Center(
                child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 880),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: children)))
          ]);
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.action});
  final String title;
  final String? action;
  @override
  Widget build(BuildContext c) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Expanded(child: Text(title, style: Theme.of(c).textTheme.titleLarge)),
        if (action != null) Text(action!)
      ]));
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key});
  @override
  Widget build(BuildContext c) => Skeletonizer(
      enabled: true,
      child: PageFrame(children: [
        Text('Financial overview', style: Theme.of(c).textTheme.headlineMedium),
        const Text('Loading current reporting period'),
        const SizedBox(height: 18),
        ...List.generate(
            5,
            (i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                    child: SizedBox(
                        height: i == 0 ? 120 : 72,
                        child: const ListTile(
                            title: Text('Loading finance data'),
                            subtitle: Text('Please wait a moment'))))))
      ]));
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext c) => Center(
      child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.cloud_off,
                size: 52, color: Theme.of(c).colorScheme.error),
            const SizedBox(height: 16),
            Text('Couldn’t load finance data',
                style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton.icon(
                onPressed: retry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'))
          ])));
}

class EmptyState extends StatelessWidget {
  const EmptyState(
      {super.key,
      required this.icon,
      required this.title,
      required this.message});
  final IconData icon;
  final String title, message;
  @override
  Widget build(BuildContext c) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 30),
      child: Column(children: [
        Icon(icon, size: 44, color: Theme.of(c).colorScheme.primary),
        const SizedBox(height: 12),
        Text(title, style: Theme.of(c).textTheme.titleMedium),
        const SizedBox(height: 5),
        Text(message, textAlign: TextAlign.center)
      ]));
}

class MemberSearch extends SearchDelegate<void> {
  MemberSearch(this.store, this.readOnly, this.pay);
  final FinanceStore store;
  final bool readOnly;
  final void Function([Map<String, dynamic>?]) pay;
  @override
  List<Widget>? buildActions(BuildContext c) =>
      [IconButton(onPressed: () => query = '', icon: const Icon(Icons.clear))];
  @override
  Widget? buildLeading(BuildContext c) =>
      BackButton(onPressed: () => close(c, null));
  @override
  Widget buildResults(BuildContext c) => buildSuggestions(c);
  @override
  Widget buildSuggestions(BuildContext c) {
    final list = store.members.where((m) => '${m['Name']} ${m['Phone Number']}'
        .toLowerCase()
        .contains(query.toLowerCase()));
    return ListView(
        padding: const EdgeInsets.all(16),
        children: list
            .map((m) => MemberTile(
                member: m, onTap: () => showMember(c, store, m, readOnly, pay)))
            .toList());
  }
}

Future<void> showMember(
    BuildContext c,
    FinanceStore store,
    Map<String, dynamic> m,
    bool ro,
    void Function([Map<String, dynamic>?]) pay) async {
  await showMemberExperience(c, store, m, ro, onPayment: () => pay(m));
}

List<(String, String, IconData, double)> recent(FinanceStore s) {
  final r = <(String, String, IconData, double)>[];
  for (final m in s.members) {
    if (number(m['Amount Paid']) > 0) {
      r.add((
        '${m['Name']} payment',
        m['Payment Date']?.toString() ?? '',
        Icons.south_west,
        number(m['Amount Paid'])
      ));
    }
  }
  for (final e in s.expenses) {
    r.add((
      e['Description']?.toString() ?? 'Expense',
      e['Date']?.toString() ?? '',
      Icons.north_east,
      -number(e['Amount'])
    ));
  }
  return r;
}

String money(double v) {
  final sign = v < 0 ? '-' : '';
  final n = v.abs().round().toString(), b = StringBuffer();
  for (var i = 0; i < n.length; i++) {
    if (i > 0 && (n.length - i) % 3 == 0) b.write(',');
    b.write(n[i]);
  }
  return sign.isEmpty ? 'Rs $b' : '- Rs $b';
}

String iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String? requiredText(String? v) =>
    v == null || v.trim().isEmpty ? 'This field is required' : null;
Color statusColor(String? s) => s == 'Paid'
    ? AppColors.success
    : s == 'Partially Paid'
        ? AppColors.warning
        : AppColors.error;
void showError(BuildContext c, Object e) =>
    ScaffoldMessenger.of(c).showSnackBar(SnackBar(
        content: Text(e.toString()), behavior: SnackBarBehavior.floating));
