#include "NSGeneratorMeta.hpp"

NSGeneratorMeta::NSGeneratorMeta(string namespace_prefix,
                                 shared_ptr<IGeneratorMeta> parent)
    : _namespace_prefix(std::move(namespace_prefix)),
      _parent(std::move(parent)) {}

const string &NSGeneratorMeta::group() const { return this->_parent->group(); }
string &NSGeneratorMeta::namespace_prefix() { return this->_namespace_prefix; }
const string &NSGeneratorMeta::namespace_prefix() const {
  return this->_namespace_prefix;
}
bool NSGeneratorMeta::cached() const { return this->_parent->cached(); }
bool NSGeneratorMeta::completed() const { return this->_parent->completed(); }
const set<string> &NSGeneratorMeta::extensions() const {
  return this->_parent->extensions();
}
shared_ptr<IGeneratorMeta> &NSGeneratorMeta::parent() { return this->_parent; }
const shared_ptr<IGeneratorMeta> &NSGeneratorMeta::parent() const {
  return this->_parent;
}

IGeneratorMeta &NSGeneratorMeta::operator+=(const IGeneratorMeta &that) {
  *(this->_parent) += that;
  return *this;
}
bool NSGeneratorMeta::equals(const IGeneratorMeta &that) const {
  return this->group() == that.group() &&
         this->namespace_prefix() == that.namespace_prefix() &&
         this->cached() == that.cached() &&
         this->completed() == that.completed() &&
         this->extensions() == that.extensions();
}

bool NSGeneratorMeta::empty() const {
  if (this->_parent) {
    return this->_parent->empty();
  }
  return true;
}