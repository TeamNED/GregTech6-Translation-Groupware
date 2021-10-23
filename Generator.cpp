#include "Generator.hpp"

Generator::Generator(string group, string namespace_prefix, bool cached,
                     bool completed, vector<string> extentions)
    : _group(group), _namespace_prefix(namespace_prefix), _cached(cached),
      _completed(completed), _extentions(extentions) {}

Generator::~Generator() {}

const string &Generator::group() { return this->_group; }
const string &Generator::namespace_prefix() { return this->_namespace_prefix; }
bool Generator::cached() { return this->_cached; }
bool Generator::completed() { return this->_completed; }
const vector<string> Generator::extentions() { return this->_extentions; }