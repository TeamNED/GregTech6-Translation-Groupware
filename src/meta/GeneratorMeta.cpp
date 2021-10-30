#include "GeneratorMeta.hpp"

GeneratorMeta::GeneratorMeta(string group, string namespace_prefix, bool cached,
                             bool completed, vector<string> extentions)
    : _group(group), _namespace_prefix(namespace_prefix), _cached(cached),
      _completed(completed), _extentions(extentions){};

string &GeneratorMeta::group() { return this->_group; }
string &GeneratorMeta::namespace_prefix() { return this->_namespace_prefix; }
bool &GeneratorMeta::cached() { return this->_cached; }
bool &GeneratorMeta::completed() { return this->_completed; }
vector<string> &GeneratorMeta::extentions() { return this->_extentions; }

const string &GeneratorMeta::group() const { return this->_group; }
const string &GeneratorMeta::namespace_prefix() const {
  return this->_namespace_prefix;
}
bool GeneratorMeta::cached() const { return this->_cached; }
bool GeneratorMeta::completed() const { return this->_completed; }
const vector<string> &GeneratorMeta::extentions() const {
  return this->_extentions;
}