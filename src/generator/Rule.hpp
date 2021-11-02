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
  Rule(string source, string target);
  Rule(string source, string target, vector<string> subs);

  string &source();
  string &target();
  vector<string> &subs();
};
#endif