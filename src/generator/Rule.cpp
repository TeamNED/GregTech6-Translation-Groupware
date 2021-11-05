#include "Rule.hpp"

Rule::Rule(string source, string target)
    : _source(std::move(source)), _target(std::move(target)), _subs({}) {}

Rule::Rule(string source, string target, vector<string> subs)
    : _source(std::move(source)), _target(std::move(target)),
      _subs(std::move(subs)) {}

string &Rule::source() { return this->_source; }
string &Rule::target() { return this->_target; }
vector<string> &Rule::subs() { return this->_subs; }
