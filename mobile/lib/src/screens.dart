import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:modal_bottom_sheet/modal_bottom_sheet.dart';
import 'package:skeletonizer/skeletonizer.dart';
import 'package:toastification/toastification.dart';

import 'api_client.dart';
import 'theme.dart';

typedef SignedIn = void Function(String role);

class AppLaunchScreen extends StatelessWidget {
  const AppLaunchScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Icon(
                  Iconsax.wallet_3,
                  size: 34,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(height: 24),
              const SizedBox(
                width: 120,
                child: LinearProgressIndicator(
                    borderRadius: BorderRadius.all(Radius.circular(8))),
              ),
            ],
          ).animate().fadeIn(duration: 350.ms).scaleXY(begin: .96),
        ),
      );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.client,
    required this.onSignedIn,
  });
  final ApiClient client;
  final SignedIn onSignedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final user = TextEditingController();
  final password = TextEditingController();
  bool obscure = true;
  bool busy = false;
  String? error;

  Future<void> submit() async {
    if (user.text.trim().isEmpty || password.text.isEmpty) {
      setState(() => error = 'Enter your username and password.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await widget.client.request(
        '/api/auth/login',
        method: 'POST',
        body: {'username': user.text.trim(), 'password': password.text},
      );
      widget.client.token = result['token']?.toString();
      widget.onSignedIn(result['role']?.toString() ?? 'admin');
    } catch (e) {
      setState(() => error = e.toString());
      if (mounted) {
        toastification.show(
          context: context,
          type: ToastificationType.error,
          style: ToastificationStyle.flatColored,
          title: const Text('Couldn’t sign in'),
          description: Text(e.toString()),
          autoCloseDuration: const Duration(seconds: 4),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpace.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Iconsax.wallet_3,
                    size: 56,
                    color: AppColors.emerald,
                  ).animate().fadeIn(duration: 350.ms).scaleXY(begin: .9),
                  const SizedBox(height: 16),
                  Text(
                    'United Pakistan',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const Text(
                    'Finance management, wherever you are.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.slate),
                  ),
                  const SizedBox(height: 36),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: AutofillGroup(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Sign in',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Use your organization credentials.',
                              style: TextStyle(color: AppColors.slate),
                            ),
                            const SizedBox(height: 20),
                            TextField(
                              controller: user,
                              autofillHints: const [AutofillHints.username],
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(
                                labelText: 'Username',
                                prefixIcon: Icon(Icons.person_outline),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: password,
                              obscureText: obscure,
                              autofillHints: const [AutofillHints.password],
                              onSubmitted: (_) => submit(),
                              decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  tooltip: obscure
                                      ? 'Show password'
                                      : 'Hide password',
                                  onPressed: () =>
                                      setState(() => obscure = !obscure),
                                  icon: Icon(
                                    obscure
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                            ),
                            if (error != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 12),
                                child: Text(
                                  error!,
                                  style: const TextStyle(
                                    color: AppColors.error,
                                  ),
                                ),
                              ),
                            const SizedBox(height: 18),
                            ElevatedButton(
                              onPressed: busy ? null : submit,
                              child: busy
                                  ? const SizedBox.square(
                                      dimension: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text('Sign in'),
                            ),
                            TextButton(
                              onPressed: () => showDialog<void>(
                                context: context,
                                builder: (_) => const AlertDialog(
                                  title: Text('Forgot password?'),
                                  content: Text(
                                    'Password recovery is managed by your organization administrator. Contact them to restore access.',
                                  ),
                                ),
                              ),
                              child: const Text('Forgot password?'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(delay: 100.ms, duration: 350.ms)
                      .slideY(begin: .04),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({
    super.key,
    required this.client,
    required this.readOnly,
    required this.onSignOut,
  });
  final ApiClient client;
  final bool readOnly;
  final VoidCallback onSignOut;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int index = 0;
  String month = 'September 2026';
  late final pages = [
    HomeScreen(onRecordPayment: showPayment),
    MembersScreen(readOnly: widget.readOnly, onRecordPayment: showPayment),
    ActivityScreen(readOnly: widget.readOnly, onAddExpense: showExpense),
    MoreScreen(readOnly: widget.readOnly, onSignOut: widget.onSignOut),
  ];

  void showPayment() {
    if (widget.readOnly) return showReadOnly();
    showCupertinoModalBottomSheet<void>(
      context: context,
      builder: (_) => const PaymentSheet(),
    );
  }

  void showExpense() {
    if (widget.readOnly) return showReadOnly();
    showCupertinoModalBottomSheet<void>(
      context: context,
      builder: (_) => const ExpenseSheet(),
    );
  }

  void showReadOnly() => showDialog<void>(
        context: context,
        builder: (_) => const AlertDialog(
          icon: Icon(Icons.lock_outline, color: AppColors.emerald),
          title: Text('Read only'),
          content: Text(
            'You can view financial records, but your account cannot make changes.',
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.surface,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        title: const Text(
          'United Pakistan',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          if (widget.readOnly)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Badge(
                backgroundColor:
                    Theme.of(context).colorScheme.secondaryContainer,
                label: const Text('READ ONLY'),
              ),
            ),
          IconButton(
            tooltip: 'Search',
            onPressed: () =>
                showSearch(context: context, delegate: MemberSearch()),
            icon: const Icon(Icons.search),
          ),
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(
                builder: (_) => const NotificationsScreen(),
              ),
            ),
            icon: const Icon(Icons.notifications_none),
          ),
        ],
      ),
      body: Column(
        children: [
          Material(
            color: Colors.white,
            child: InkWell(
              onTap: () async {
                final selected = await showCupertinoModalBottomSheet<String>(
                  context: context,
                  builder: (_) => const MonthSheet(),
                );
                if (selected != null) setState(() => month = selected);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_month_outlined,
                      size: 19,
                      color: AppColors.emerald,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        month,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    const Icon(Icons.expand_more),
                  ],
                ),
              ),
            ),
          ),
          const OfflineBanner(),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              switchInCurve: Curves.easeOutCubic,
              child: KeyedSubtree(
                key: ValueKey(index),
                child: pages[index],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(
              icon: Icon(Iconsax.home_2_copy),
              selectedIcon: Icon(Iconsax.home_2),
              label: 'Home'),
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
              label: 'More'),
        ],
      ),
    );
  }
}

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onRecordPayment});
  final VoidCallback onRecordPayment;
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async =>
          Future<void>.delayed(const Duration(milliseconds: 500)),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Good morning',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const Text(
            'Here’s what needs your attention today.',
            style: TextStyle(color: AppColors.slate),
          ),
          const SizedBox(height: 18),
          const Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              Kpi(
                label: 'Collected',
                value: 'PKR 184,500',
                icon: Icons.trending_up,
                color: AppColors.success,
              ),
              Kpi(
                label: 'Outstanding',
                value: 'PKR 32,000',
                icon: Icons.schedule,
                color: AppColors.warning,
              ),
              Kpi(
                label: 'Expenses',
                value: 'PKR 41,750',
                icon: Icons.trending_down,
                color: AppColors.error,
              ),
              Kpi(
                label: 'Net balance',
                value: 'PKR 142,750',
                icon: Icons.account_balance_wallet_outlined,
                color: AppColors.info,
              ),
            ],
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: onRecordPayment,
            icon: const Icon(Icons.add_card),
            label: const Text('Record payment'),
          ),
          const SizedBox(height: 22),
          const SectionTitle('Cash flow', action: 'Last 6 months'),
          const SizedBox(height: 8),
          const CashFlowCard(),
          const SizedBox(height: 22),
          const SectionTitle('Needs attention', action: 'View all'),
          const SizedBox(height: 8),
          const Card(
            child: Column(
              children: [
                ActionRow(
                  icon: Icons.error_outline,
                  color: AppColors.error,
                  title: '5 overdue members',
                  subtitle: 'PKR 21,500 outstanding',
                ),
                Divider(height: 1),
                ActionRow(
                  icon: Icons.timelapse,
                  color: AppColors.warning,
                  title: '3 partial payments',
                  subtitle: 'Follow up this week',
                ),
                Divider(height: 1),
                ActionRow(
                  icon: Icons.campaign_outlined,
                  color: AppColors.info,
                  title: 'Special fund at 64%',
                  subtitle: 'PKR 270,000 remaining',
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const SectionTitle('Recent activity', action: 'See all'),
          const SizedBox(height: 8),
          const Card(
            child: Column(
              children: [
                ActivityRow(
                  name: 'Sana Ahmed',
                  detail: 'Monthly payment',
                  amount: '+ PKR 5,000',
                  positive: true,
                ),
                Divider(height: 1),
                ActivityRow(
                  name: 'Electricity bill',
                  detail: 'Utilities · Today',
                  amount: '− PKR 8,200',
                  positive: false,
                ),
                Divider(height: 1),
                ActivityRow(
                  name: 'Bilal Tanveer',
                  detail: 'Special fund',
                  amount: '+ PKR 10,000',
                  positive: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class Kpi extends StatelessWidget {
  const Kpi({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label, value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: MediaQuery.sizeOf(context).width >= 600
            ? 230
            : (MediaQuery.sizeOf(context).width - 42) / 2,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(height: 12),
                Text(
                  value,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800),
                ),
                Text(label, style: const TextStyle(color: AppColors.slate)),
              ],
            ),
          ),
        ),
      );
}

class CashFlowCard extends StatelessWidget {
  const CashFlowCard({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: scheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 7),
                const Text('Collections', style: TextStyle(fontSize: 12)),
                const SizedBox(width: 16),
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: AppColors.gold,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 7),
                const Text('Expenses', style: TextStyle(fontSize: 12)),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 150,
              child: Semantics(
                label:
                    'Collections remain above expenses across the last six months',
                child: LineChart(
                  LineChartData(
                    minY: 0,
                    maxY: 220,
                    borderData: FlBorderData(show: false),
                    gridData: FlGridData(
                      drawVerticalLine: false,
                      horizontalInterval: 55,
                      getDrawingHorizontalLine: (_) => FlLine(
                        color: scheme.outlineVariant.withValues(alpha: .45),
                        strokeWidth: 1,
                      ),
                    ),
                    titlesData: const FlTitlesData(
                      topTitles:
                          AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      rightTitles:
                          AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      leftTitles:
                          AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                    ),
                    lineBarsData: [
                      LineChartBarData(
                        isCurved: true,
                        curveSmoothness: .28,
                        barWidth: 3,
                        color: scheme.primary,
                        dotData: const FlDotData(show: false),
                        belowBarData: BarAreaData(
                          show: true,
                          color: scheme.primary.withValues(alpha: .1),
                        ),
                        spots: const [
                          FlSpot(0, 112),
                          FlSpot(1, 136),
                          FlSpot(2, 128),
                          FlSpot(3, 165),
                          FlSpot(4, 154),
                          FlSpot(5, 184.5),
                        ],
                      ),
                      LineChartBarData(
                        isCurved: true,
                        curveSmoothness: .28,
                        barWidth: 2.5,
                        color: AppColors.gold,
                        dotData: const FlDotData(show: false),
                        spots: const [
                          FlSpot(0, 52),
                          FlSpot(1, 38),
                          FlSpot(2, 67),
                          FlSpot(3, 44),
                          FlSpot(4, 59),
                          FlSpot(5, 41.75),
                        ],
                      ),
                    ],
                  ),
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.easeOutCubic,
                ),
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 120.ms).slideY(begin: .04);
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action});
  final String title;
  final String? action;
  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          if (action != null)
            Text(
              action!,
              style: const TextStyle(
                color: AppColors.emerald,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      );
}

class ActionRow extends StatelessWidget {
  const ActionRow({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final Color color;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: .12),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
      );
}

class ActivityRow extends StatelessWidget {
  const ActivityRow({
    super.key,
    required this.name,
    required this.detail,
    required this.amount,
    required this.positive,
  });
  final String name, detail, amount;
  final bool positive;
  @override
  Widget build(BuildContext context) => ListTile(
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(detail),
        trailing: Text(
          amount,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: positive ? AppColors.success : AppColors.error,
          ),
        ),
      );
}

const members = [
  ('Ali Hassan', '0300 1112222', 'Paid', 'PKR 5,000'),
  ('Fatima Siddiqui', '0301 2223333', 'Partial', 'PKR 2,500'),
  ('Muhammad Khan', '0302 3334444', 'Pending', 'PKR 0'),
  ('Zainab Sheikh', '0303 4445555', 'Paid', 'PKR 5,000'),
  ('Rashid Ali', '0304 5556666', 'Partial', 'PKR 3,000'),
  ('Sadia Noor', '0305 6667777', 'Pending', 'PKR 0'),
  ('Bilal Tanveer', '0306 7778888', 'Paid', 'PKR 5,000'),
];

class MembersScreen extends StatefulWidget {
  const MembersScreen({
    super.key,
    required this.readOnly,
    required this.onRecordPayment,
  });
  final bool readOnly;
  final VoidCallback onRecordPayment;
  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  String query = '';
  String filter = 'All';
  bool loading = true;
  Timer? _loadingTimer;

  @override
  void initState() {
    super.initState();
    _loadingTimer = Timer(const Duration(milliseconds: 450), () {
      if (mounted) setState(() => loading = false);
    });
  }

  @override
  void dispose() {
    _loadingTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visible = members
        .where(
          (m) =>
              (filter == 'All' || m.$3 == filter) &&
              m.$1.toLowerCase().contains(query.toLowerCase()),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            onChanged: (v) => setState(() => query = v),
            decoration: const InputDecoration(
              hintText: 'Search members by name',
              prefixIcon: Icon(Icons.search),
              suffixIcon: Icon(Icons.tune),
            ),
          ),
        ),
        SizedBox(
          height: 42,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: ['All', 'Paid', 'Partial', 'Pending']
                .map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(item),
                      selected: filter == item,
                      onSelected: (_) => setState(() => filter = item),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        Expanded(
          child: Skeletonizer(
            enabled: loading,
            child: visible.isEmpty
                ? const EmptyState(
                    icon: Icons.person_search,
                    title: 'No members found',
                    body: 'Try another name or clear your filters.',
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: visible.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final m = visible[i];
                      return Card(
                        child: ListTile(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => MemberDetail(
                                member: m,
                                readOnly: widget.readOnly,
                                onRecordPayment: widget.onRecordPayment,
                              ),
                            ),
                          ),
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFFDDF3EC),
                            child: Text(
                              m.$1.split(' ').map((x) => x[0]).take(2).join(),
                              style: const TextStyle(
                                color: AppColors.emerald,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          title: Text(
                            m.$1,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(m.$2),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              StatusBadge(m.$3),
                              const SizedBox(height: 3),
                              Text(
                                m.$4,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final color = status == 'Paid'
        ? AppColors.success
        : status == 'Partial'
            ? AppColors.warning
            : AppColors.error;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class MemberDetail extends StatelessWidget {
  const MemberDetail({
    super.key,
    required this.member,
    required this.readOnly,
    required this.onRecordPayment,
  });
  final (String, String, String, String) member;
  final bool readOnly;
  final VoidCallback onRecordPayment;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Member details')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: const Color(0xFFDDF3EC),
                  child: Text(
                    member.$1[0],
                    style:
                        const TextStyle(fontSize: 22, color: AppColors.emerald),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        member.$1,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(
                        member.$2,
                        style: const TextStyle(color: AppColors.slate),
                      ),
                    ],
                  ),
                ),
                StatusBadge(member.$3),
              ],
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Outstanding balance',
                      style: TextStyle(color: AppColors.slate),
                    ),
                    Text(
                      member.$3 == 'Paid'
                          ? 'PKR 0'
                          : member.$3 == 'Partial'
                              ? 'PKR 2,000'
                              : 'PKR 5,000',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const Divider(height: 28),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Monthly due'),
                        Text(
                          'PKR 5,000',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: readOnly ? null : onRecordPayment,
                    icon: const Icon(Icons.add_card),
                    label: const Text('Record payment'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  tooltip: 'Send reminder',
                  onPressed: () {},
                  icon: const Icon(Icons.notifications_active_outlined),
                ),
                IconButton.filledTonal(
                  tooltip: 'Edit member',
                  onPressed: readOnly ? null : () {},
                  icon: const Icon(Icons.edit_outlined),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const SectionTitle('Payment history', action: 'View all'),
            const SizedBox(height: 8),
            const Card(
              child: Column(
                children: [
                  ActivityRow(
                    name: '1 Sep 2026',
                    detail: 'Monthly payment',
                    amount: 'PKR 5,000',
                    positive: true,
                  ),
                  Divider(height: 1),
                  ActivityRow(
                    name: '1 Aug 2026',
                    detail: 'Monthly payment',
                    amount: 'PKR 5,000',
                    positive: true,
                  ),
                  Divider(height: 1),
                  ActivityRow(
                    name: '2 Jul 2026',
                    detail: 'Partial payment',
                    amount: 'PKR 3,000',
                    positive: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionTitle('Follow-ups'),
            const SizedBox(height: 8),
            const Card(
              child: ActionRow(
                icon: Icons.chat_outlined,
                color: AppColors.info,
                title: 'Reminder sent',
                subtitle: '28 Aug · Awaiting reply',
              ),
            ),
          ],
        ),
      );
}

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({
    super.key,
    required this.readOnly,
    required this.onAddExpense,
  });
  final bool readOnly;
  final VoidCallback onAddExpense;
  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  int tab = 0;
  @override
  Widget build(BuildContext context) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('Payments')),
                ButtonSegment(value: 1, label: Text('Expenses')),
                ButtonSegment(value: 2, label: Text('Special fund')),
              ],
              selected: {tab},
              onSelectionChanged: (v) => setState(() => tab = v.first),
              showSelectedIcon: false,
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        ['Payments', 'Expenses', 'Special fund'][tab],
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Filter',
                      onPressed: () => showCupertinoModalBottomSheet<void>(
                        context: context,
                        builder: (_) => const FilterSheet(),
                      ),
                      icon: const Icon(Icons.tune),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (tab == 2) ...[
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Central Convention Fund',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          SizedBox(height: 12),
                          LinearProgressIndicator(
                            value: .64,
                            minHeight: 8,
                            borderRadius: BorderRadius.all(Radius.circular(8)),
                          ),
                          SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [Text('PKR 480,000 raised'), Text('64%')],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                Card(
                  child: Column(
                    children: tab == 1
                        ? const [
                            ActivityRow(
                              name: 'Electricity bill',
                              detail: 'Utilities · Today',
                              amount: '− PKR 8,200',
                              positive: false,
                            ),
                            Divider(height: 1),
                            ActivityRow(
                              name: 'Office stationery',
                              detail: 'Supplies · Yesterday',
                              amount: '− PKR 2,450',
                              positive: false,
                            ),
                            Divider(height: 1),
                            ActivityRow(
                              name: 'Venue deposit',
                              detail: 'Events · 29 Aug',
                              amount: '− PKR 15,000',
                              positive: false,
                            ),
                          ]
                        : const [
                            ActivityRow(
                              name: 'Sana Ahmed',
                              detail: 'Today, 10:24 AM',
                              amount: '+ PKR 5,000',
                              positive: true,
                            ),
                            Divider(height: 1),
                            ActivityRow(
                              name: 'Rashid Ali',
                              detail: 'Today, 9:18 AM',
                              amount: '+ PKR 3,000',
                              positive: true,
                            ),
                            Divider(height: 1),
                            ActivityRow(
                              name: 'Bilal Tanveer',
                              detail: 'Yesterday',
                              amount: '+ PKR 10,000',
                              positive: true,
                            ),
                          ],
                  ),
                ),
              ],
            ),
          ),
          if (tab == 1 && !widget.readOnly)
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: widget.onAddExpense,
                  icon: const Icon(Icons.add),
                  label: const Text('Add expense'),
                ),
              ),
            ),
        ],
      );
}

class MoreScreen extends StatelessWidget {
  const MoreScreen({
    super.key,
    required this.readOnly,
    required this.onSignOut,
  });
  final bool readOnly;
  final VoidCallback onSignOut;
  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Text('AA')),
              title: const Text(
                'Ahmed Ali',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(readOnly ? 'Read-only account' : 'Administrator'),
              trailing: StatusBadge(readOnly ? 'Read only' : 'Admin'),
            ),
          ),
          const SizedBox(height: 20),
          const SectionTitle('Finance'),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                MoreRow(
                  Icons.bar_chart_outlined,
                  'Reports & exports',
                  () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                        builder: (_) => const ReportsScreen()),
                  ),
                ),
                const Divider(height: 1),
                MoreRow(
                    Icons.campaign_outlined, 'Special fund campaign', () {}),
                const Divider(height: 1),
                MoreRow(
                  Icons.calendar_month_outlined,
                  'Create new month',
                  readOnly ? null : () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const SectionTitle('Organization'),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                MoreRow(
                  Icons.settings_outlined,
                  'Settings',
                  readOnly ? null : () {},
                ),
                const Divider(height: 1),
                MoreRow(
                  Icons.monitor_heart_outlined,
                  'Diagnostics',
                  readOnly ? null : () {},
                ),
                const Divider(height: 1),
                MoreRow(Icons.help_outline, 'Help & support', () {}),
              ],
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: onSignOut,
            icon: const Icon(Icons.logout, color: AppColors.error),
            label: const Text('Sign out',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      );
}

class MoreRow extends StatelessWidget {
  const MoreRow(this.icon, this.label, this.onTap, {super.key});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => ListTile(
        enabled: onTap != null,
        onTap: onTap,
        leading: Icon(icon),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right),
      );
}

class PaymentSheet extends StatefulWidget {
  const PaymentSheet({super.key});
  @override
  State<PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<PaymentSheet> {
  final amount = TextEditingController(text: '5000');
  final remarks = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final value = double.tryParse(amount.text) ?? 0;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Record payment',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const Text(
              'Ali Hassan · Outstanding PKR 7,500',
              style: TextStyle(color: AppColors.slate),
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              children: [1000, 2500, 5000]
                  .map(
                    (v) => ActionChip(
                      label: Text('PKR $v'),
                      onPressed: () => setState(() => amount.text = '$v'),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Amount (PKR)',
                prefixText: 'PKR  ',
              ),
            ),
            const SizedBox(height: 12),
            const TextField(
              readOnly: true,
              decoration: InputDecoration(
                labelText: 'Payment date',
                prefixIcon: Icon(Icons.calendar_today_outlined),
                hintText: '25 Sep 2026',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: remarks,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Remarks (optional)',
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5F0),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Remaining balance'),
                  Text(
                    'PKR ${(7500 - value).clamp(0, 7500).toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.emerald,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: value <= 0
                  ? null
                  : () {
                      Navigator.pop(context);
                      showDialog<void>(
                        context: context,
                        builder: (_) => const SuccessDialog(
                          title: 'Payment recorded',
                          body:
                              'PKR 5,000 has been added to Ali Hassan’s account.',
                        ),
                      );
                    },
              child: const Text('Confirm payment'),
            ),
          ],
        ),
      ),
    );
  }
}

class ExpenseSheet extends StatelessWidget {
  const ExpenseSheet({super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 12,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(width: 42, height: 4, color: AppColors.border),
              ),
              const SizedBox(height: 16),
              Text('Add expense',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 18),
              const DropdownMenu<String>(
                expandedInsets: EdgeInsets.zero,
                label: Text('Category'),
                initialSelection: 'Utilities',
                dropdownMenuEntries: [
                  DropdownMenuEntry(value: 'Utilities', label: 'Utilities'),
                  DropdownMenuEntry(value: 'Supplies', label: 'Supplies'),
                  DropdownMenuEntry(value: 'Events', label: 'Events'),
                ],
              ),
              const SizedBox(height: 12),
              const TextField(
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Amount (PKR)',
                  prefixText: 'PKR  ',
                ),
              ),
              const SizedBox(height: 12),
              const TextField(decoration: InputDecoration(labelText: 'Payee')),
              const SizedBox(height: 12),
              const DropdownMenu<String>(
                expandedInsets: EdgeInsets.zero,
                label: Text('Payment method'),
                initialSelection: 'Cash',
                dropdownMenuEntries: [
                  DropdownMenuEntry(value: 'Cash', label: 'Cash'),
                  DropdownMenuEntry(value: 'Bank', label: 'Bank transfer'),
                  DropdownMenuEntry(value: 'Easypaisa', label: 'Easypaisa'),
                ],
              ),
              const SizedBox(height: 12),
              const TextField(
                maxLines: 2,
                decoration: InputDecoration(labelText: 'Remarks (optional)'),
              ),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  showDialog<void>(
                    context: context,
                    builder: (_) => const SuccessDialog(
                      title: 'Expense saved',
                      body: 'The expense is now included in September totals.',
                    ),
                  );
                },
                child: const Text('Save expense'),
              ),
            ],
          ),
        ),
      );
}

class FilterSheet extends StatelessWidget {
  const FilterSheet({super.key});
  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Filters',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  TextButton(onPressed: () {}, child: const Text('Clear all')),
                ],
              ),
              const SizedBox(height: 12),
              const DropdownMenu<String>(
                expandedInsets: EdgeInsets.zero,
                label: Text('Date range'),
                initialSelection: 'month',
                dropdownMenuEntries: [
                  DropdownMenuEntry(value: 'month', label: 'This month'),
                  DropdownMenuEntry(value: 'week', label: 'This week'),
                  DropdownMenuEntry(value: 'custom', label: 'Custom range'),
                ],
              ),
              const SizedBox(height: 12),
              const DropdownMenu<String>(
                expandedInsets: EdgeInsets.zero,
                label: Text('Sort by'),
                initialSelection: 'new',
                dropdownMenuEntries: [
                  DropdownMenuEntry(value: 'new', label: 'Newest first'),
                  DropdownMenuEntry(value: 'high', label: 'Highest amount'),
                ],
              ),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Apply filters'),
              ),
            ],
          ),
        ),
      );
}

class MonthSheet extends StatelessWidget {
  const MonthSheet({super.key});
  @override
  Widget build(BuildContext context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          children: [
            Text('Reporting month',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ...['September 2026', 'August 2026', 'July 2026'].map(
              (m) => ListTile(
                onTap: () => Navigator.pop(context, m),
                title: Text(m),
                trailing: m == 'September 2026'
                    ? const Icon(Icons.check, color: AppColors.emerald)
                    : null,
              ),
            ),
          ],
        ),
      );
}

class SuccessDialog extends StatelessWidget {
  const SuccessDialog({super.key, required this.title, required this.body});
  final String title, body;
  @override
  Widget build(BuildContext context) => AlertDialog(
        icon: const CircleAvatar(
          backgroundColor: Color(0xFFDDF3EC),
          child: Icon(Icons.check, color: AppColors.success),
        ),
        title: Text(title),
        content: Text(body, textAlign: TextAlign.center),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Done'),
          ),
        ],
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title, body;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 52, color: AppColors.slate),
              const SizedBox(height: 14),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                body,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.slate),
              ),
            ],
          ),
        ),
      );
}

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Reports')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                Kpi(
                  label: 'Collections',
                  value: 'PKR 184,500',
                  icon: Icons.trending_up,
                  color: AppColors.success,
                ),
                Kpi(
                  label: 'Expenses',
                  value: 'PKR 41,750',
                  icon: Icons.trending_down,
                  color: AppColors.error,
                ),
                Kpi(
                  label: 'Net balance',
                  value: 'PKR 142,750',
                  icon: Icons.wallet_outlined,
                  color: AppColors.info,
                ),
                Kpi(
                  label: 'Members',
                  value: '124',
                  icon: Icons.people_outline,
                  color: AppColors.emerald,
                ),
              ],
            ),
            const SizedBox(height: 20),
            const SectionTitle('Monthly collection trend'),
            const SizedBox(height: 8),
            Card(
              child: SizedBox(
                height: 180,
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [65, 78, 88, 100, 82, 94]
                        .map(
                          (h) => Expanded(
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 5),
                              child: Container(
                                height: h.toDouble(),
                                decoration: const BoxDecoration(
                                  color: AppColors.emerald,
                                  borderRadius: BorderRadius.vertical(
                                    top: Radius.circular(5),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const SectionTitle('Export'),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: [
                  MoreRow(Icons.picture_as_pdf_outlined, 'Export PDF', () {}),
                  const Divider(height: 1),
                  MoreRow(Icons.table_view_outlined, 'Export Excel', () {}),
                  const Divider(height: 1),
                  MoreRow(Icons.share_outlined, 'Share report', () {}),
                ],
              ),
            ),
          ],
        ),
      );
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: const EmptyState(
          icon: Icons.notifications_none,
          title: 'You’re all caught up',
          body:
              'Payment reminders and important finance updates will appear here when notification support is enabled.',
        ),
      );
}

class MemberSearch extends SearchDelegate<void> {
  @override
  List<Widget>? buildActions(BuildContext context) => [
        IconButton(onPressed: () => query = '', icon: const Icon(Icons.close)),
      ];
  @override
  Widget? buildLeading(BuildContext context) => IconButton(
        onPressed: () => close(context, null),
        icon: const Icon(Icons.arrow_back),
      );
  @override
  Widget buildResults(BuildContext context) => _results();
  @override
  Widget buildSuggestions(BuildContext context) => _results();
  Widget _results() {
    final found = members
        .where((m) => m.$1.toLowerCase().contains(query.toLowerCase()))
        .toList();
    return found.isEmpty
        ? const EmptyState(
            icon: Icons.search_off,
            title: 'No members found',
            body: 'Try a different name or phone number.',
          )
        : ListView(
            children: found
                .map(
                  (m) => ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.person_outline),
                    ),
                    title: Text(m.$1),
                    subtitle: Text(m.$2),
                    trailing: StatusBadge(m.$3),
                  ),
                )
                .toList(),
          );
  }
}
