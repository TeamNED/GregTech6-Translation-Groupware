#include "IGeneratorMeta.hpp"

bool operator==(const IGeneratorMeta &lhs, const IGeneratorMeta &rhs) {
  return lhs.equals(rhs);
}
bool operator!=(const IGeneratorMeta &lhs, const IGeneratorMeta &rhs) {
  return !(lhs == rhs);
}
bool IGeneratorMeta::contains(const IGeneratorMeta &that) const {
  const string &this_ns = this->namespace_prefix();
  const string &that_ns = that.namespace_prefix();
  if (that_ns.rfind(this_ns, 0) == 0) {
    // this_ns is started with that_ns
    const auto &this_ext = this->extensions();
    const auto &that_ext = that.extensions();
    for (const auto &this_ext_item : this_ext) {
      if (that_ext.find(this_ext_item) == that_ext.cend()) {
        return false;
      }
    }
    return true;
  }
  return false;
}

IGeneratorMeta::operator bool() const { return !(this->empty()); }