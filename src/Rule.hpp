#ifndef RULE_H
#define RULE_H
#pragma once

#include <string>
#include <vector>

using std::string;
using std::vector;

class Rule {
private:
  string _source, _target;
  vector<string> _subs;

public:
  Rule() = default;
  Rule(const string &source, const string &target);
  Rule(const string &source, const string &target, const vector<string> &subs);
  Rule(Rule &&) = default;
  ~Rule() = default;
  Rule &operator=(const Rule &) = default;
  Rule &operator=(Rule &&) = default;

  string &source();
  string &target();
  vector<string> &subs();
};
#endif