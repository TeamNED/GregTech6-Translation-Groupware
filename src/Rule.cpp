#include "Rule.hpp"

Rule::Rule(const string &source, const string &target)
    : _source(source), _target(target), _subs({}) {}

Rule::Rule(const string &source, const string &target,
           const vector<string> &subs)
    : _source(source), _target(target), _subs(subs) {}

string &Rule::source() { return this->_source; }
string &Rule::target() { return this->_target; }
vector<string> &Rule::subs() { return this->_subs; }
