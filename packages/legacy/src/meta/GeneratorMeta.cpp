#include "GeneratorMeta.hpp"

GeneratorMeta::GeneratorMeta(const IGeneratorMeta &that)
    : _group(that.group()), _namespace_prefix(that.namespace_prefix()),
      _cached(that.cached()), _completed(that.completed()),
      _extensions(that.extensions()){};
GeneratorMeta::GeneratorMeta(string group, string namespace_prefix, bool cached,
                             bool completed, set<string> extensions)
    : _group(group), _namespace_prefix(namespace_prefix), _cached(cached),
      _completed(completed), _extensions(extensions){};

string &GeneratorMeta::group() { return this->_group; }
string &GeneratorMeta::namespace_prefix() { return this->_namespace_prefix; }
bool &GeneratorMeta::cached() { return this->_cached; }
bool &GeneratorMeta::completed() { return this->_completed; }
set<string> &GeneratorMeta::extensions() { return this->_extensions; }

const string &GeneratorMeta::group() const { return this->_group; }
const string &GeneratorMeta::namespace_prefix() const {
  return this->_namespace_prefix;
}
bool GeneratorMeta::cached() const { return this->_cached; }
bool GeneratorMeta::completed() const { return this->_completed; }
const set<string> &GeneratorMeta::extensions() const {
  return this->_extensions;
}

GeneratorMeta &GeneratorMeta::operator+=(const IGeneratorMeta &that) {
  if (*this) {
    // valid
    string &this_ns = this->namespace_prefix();
    const string &that_ns = that.namespace_prefix();
    if (this_ns.rfind(that_ns, 0) == 0) {
      // this_ns is started with that_ns
      // unchanged
    } else if (that_ns.rfind(this_ns, 0) == 0) {
      // that_ns is started with this_ns
      this_ns = that_ns;
    } else {
      // not valid
      this->group().clear();
      return *this;
    }
    this->extensions().insert(that.extensions().cbegin(),
                              that.extensions().cend());
  }
  return *this;
}
bool GeneratorMeta::equals(const IGeneratorMeta &that) const {
  return this->group() == that.group() &&
         this->namespace_prefix() == that.namespace_prefix() &&
         this->cached() == that.cached() &&
         this->completed() == that.completed() &&
         this->extensions() == that.extensions();
}
bool GeneratorMeta::empty() const { return this->group().empty(); }
