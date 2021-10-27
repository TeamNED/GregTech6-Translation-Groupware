#include "DictGenerator.hpp"

DictGenerator::DictGenerator(string group, string namespace_prefix, bool cached,
                             bool completed, vector<string> extensions,
                             map<string, string> dict)
    : Generator(group, namespace_prefix, cached, completed, extensions),
      _dict(dict) {}

map<string, string> &DictGenerator::dict() { return this->_dict; }