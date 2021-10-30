#include "Rule.hpp"

Rule::Rule(string source, string target)
    : _source(source), _target(target), _subs({}) {}

Rule::Rule(string source, string target, vector<string> subs)
    : _source(source), _target(target), _subs(subs) {}

string &Rule::source() { return this->_source; }
string &Rule::target() { return this->_target; }
vector<string> &Rule::subs() { return this->_subs; }
