import 'package:flutter/foundation.dart';

import 'api_client.dart';

double number(Object? value) => double.tryParse(value?.toString() ?? '') ?? 0;

class FinanceStore extends ChangeNotifier {
  FinanceStore(this.api);
  final ApiClient api;
  List<String> months = const [];
  String? month;
  List<Map<String, dynamic>> members = const [];
  List<Map<String, dynamic>> expenses = const [];
  List<Map<String, dynamic>> followUps = const [];
  List<Map<String, dynamic>> contributions = const [];
  Map<String, dynamic> settings = const {};
  bool loading = true;
  bool refreshing = false;
  String? error;
  String? refreshError;

  double get due => members.fold(0, (s, m) => s + number(m['Total Payable']));
  double get collected =>
      members.fold(0, (s, m) => s + number(m['Amount Paid']));
  double get outstanding =>
      members.fold(0, (s, m) => s + number(m['Remaining Balance']));
  double get spent => expenses.fold(0, (s, e) => s + number(e['Amount']));
  double get balance => collected - spent;

  Future<void> initialize() async {
    loading = month == null;
    error = null;
    refreshError = null;
    notifyListeners();
    try {
      final result = await Future.wait(
          [api.request('/api/months'), api.request('/api/settings')]);
      months = List<String>.from(
          (result[0]['data'] as List? ?? const []).map((e) => e.toString()));
      settings =
          Map<String, dynamic>.from(result[1]['data'] as Map? ?? const {});
      final previousMonth = month;
      month = months.isEmpty
          ? null
          : months.contains(previousMonth)
              ? previousMonth
              : latestMonth(months);
      if (month != null) await _loadMonth(month!);
    } catch (e) {
      if (month == null) {
        error = e.toString();
      } else {
        refreshError = e.toString();
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> selectMonth(String value) async {
    if (value == month) return;
    loading = true;
    error = null;
    refreshError = null;
    notifyListeners();
    try {
      await _loadMonth(value);
      month = value;
    } catch (e) {
      refreshError = e.toString();
    }
    loading = false;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (month == null) return;
    refreshing = true;
    error = null;
    refreshError = null;
    notifyListeners();
    try {
      await _loadMonth(month!);
    } catch (e) {
      refreshError = e.toString();
    }
    refreshing = false;
    notifyListeners();
  }

  Future<void> _loadMonth(String selected) async {
    final result = await Future.wait([
      api.request('/api/members', query: {'month': selected}),
      api.request('/api/expenses', query: {'month': selected}),
      api.request('/api/followups', query: {'month': selected}),
    ]);
    final nextMembers = _rows(result[0]['data']);
    final nextExpenses = _rows(result[1]['data']);
    final nextFollowUps = _rows(result[2]['data']);
    var nextContributions = contributions;
    final campaign = settings['SPECIAL_FUND_CAMPAIGN_ID']?.toString();
    if (campaign != null && campaign.isNotEmpty) {
      final fund = await api
          .request('/api/special-fund', query: {'campaignId': campaign});
      nextContributions = _rows(fund['data']);
    }
    // Commit a complete snapshot only after every request succeeds. This keeps
    // the last known-good data visible when a refresh is interrupted/offline.
    members = nextMembers;
    expenses = nextExpenses;
    followUps = nextFollowUps;
    contributions = nextContributions;
  }

  List<Map<String, dynamic>> _rows(Object? value) =>
      (value as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  Future<List<Map<String, dynamic>>> history(
      Map<String, dynamic> member) async {
    final result = await api.request('/api/members/history',
        query: {'name': member['Name'], 'phone': member['Phone Number']});
    return _rows(result['data']);
  }

  Future<List<Map<String, dynamic>>> memberFollowUps(
      Map<String, dynamic> member) async {
    final result = await api.request('/api/followups/member', query: {
      'month': month,
      'name': member['Name'],
      'phone': member['Phone Number'],
    });
    return _rows(result['data']);
  }

  Future<void> saveMember(Map<String, dynamic> data, {int? rowId}) async {
    if (rowId == null) {
      await api.request('/api/members', method: 'POST', body: {
        'month': month,
        'data': data,
      });
    } else {
      await api.request('/api/members/$rowId', method: 'PUT', body: {
        'month': month,
        'data': data,
      });
    }
    await refresh();
  }

  Future<void> deleteMember(int rowId) async {
    await api.request('/api/members/$rowId',
        method: 'DELETE', query: {'month': month});
    await refresh();
  }

  Future<void> saveExpense(Map<String, dynamic> data, {int? rowId}) async {
    await api.request(rowId == null ? '/api/expenses' : '/api/expenses/$rowId',
        method: rowId == null ? 'POST' : 'PUT', body: {'data': data});
    await refresh();
  }

  Future<void> deleteExpense(int rowId) async {
    await api.request('/api/expenses/$rowId', method: 'DELETE');
    await refresh();
  }

  Future<void> addFollowUp(
      Map<String, dynamic> member, Map<String, dynamic> event) async {
    await api.request('/api/followups', method: 'POST', body: {
      'data': {
        'Month': month,
        'Member Name': member['Name'] ?? '',
        'Phone Number': member['Phone Number'] ?? '',
        'Member Category': member['Member Category'] ?? 'Fellow Member (FM)',
        'Event Date': DateTime.now().toIso8601String(),
        'Created By': settings['SECRETARY_NAME'] ?? 'Admin',
        ...event,
      }
    });
    await refresh();
  }

  Future<void> saveContribution(Map<String, dynamic> data, {int? rowId}) async {
    await api.request(
        rowId == null ? '/api/special-fund' : '/api/special-fund/$rowId',
        method: rowId == null ? 'POST' : 'PUT',
        body: {'data': data});
    await refresh();
  }

  Future<void> deleteContribution(int rowId) async {
    await api.request('/api/special-fund/$rowId', method: 'DELETE');
    await refresh();
  }

  Future<void> saveSettings(Map<String, dynamic> data) async {
    await api.request('/api/settings', method: 'POST', body: {'data': data});
    settings = {...settings, ...data};
    notifyListeners();
  }

  Future<void> createMonth(String name, bool carryBalances) async {
    await api.request('/api/months/new', method: 'POST', body: {
      'monthName': name,
      'carryBalances': carryBalances,
    });
    await initialize();
    if (months.contains(name) && month != name) await selectMonth(name);
  }

  Future<void> recordPayment(Map<String, dynamic> member, double amount,
      String date, String remarks) async {
    await api
        .request('/api/payments/${member['_rowId']}', method: 'POST', body: {
      'month': month,
      'amountPaid': amount,
      'totalPayable': number(member['Total Payable']),
      'paymentDate': date,
      'remarks': remarks,
    });
    await refresh();
  }

  Future<void> addExpense(
      {required String date,
      required String category,
      required String description,
      required double amount,
      required String paidBy,
      required String remarks}) async {
    await api.request('/api/expenses', method: 'POST', body: {
      'data': {
        'Month': month,
        'Date': date,
        'Category': category,
        'Description': description,
        'Amount': amount,
        'Paid By': paidBy,
        'Remarks': remarks,
      }
    });
    await refresh();
  }
}

String latestMonth(Iterable<String> values) {
  final items = values.toList();
  if (items.isEmpty) return '';
  const names = <String, int>{
    'january': 1,
    'february': 2,
    'march': 3,
    'april': 4,
    'may': 5,
    'june': 6,
    'july': 7,
    'august': 8,
    'september': 9,
    'october': 10,
    'november': 11,
    'december': 12,
  };
  int? rank(String value) {
    final match = RegExp(r'^\s*([A-Za-z]+)\s+(\d{4})\s*$').firstMatch(value);
    final month = match == null ? null : names[match.group(1)!.toLowerCase()];
    final year = match == null ? null : int.tryParse(match.group(2)!);
    return month == null || year == null ? null : year * 100 + month;
  }

  var latest = items.first;
  var latestRank = rank(latest);
  for (final item in items.skip(1)) {
    final itemRank = rank(item);
    if (itemRank != null && (latestRank == null || itemRank > latestRank)) {
      latest = item;
      latestRank = itemRank;
    }
  }
  return latest;
}
