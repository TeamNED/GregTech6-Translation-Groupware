#include "IGeneratorMeta.hpp"

bool operator==(const IGeneratorMeta &lhs, const IGeneratorMeta &rhs) {
  return lhs.equals(rhs);
}
bool operator!=(const IGeneratorMeta &lhs, const IGeneratorMeta &rhs) {
  return !(lhs == rhs);
}

IGeneratorMeta::operator bool() const { return !(this->empty()); }