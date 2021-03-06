#ifndef IGENERATORMETA_H
#define IGENERATORMETA_H
#pragma once

#include <set>
#include <string>

using std::set;
using std::string;

class IGeneratorMeta {
public:
  virtual const string &group() const = 0;
  virtual const string &namespace_prefix() const = 0;
  virtual bool cached() const = 0;
  virtual bool completed() const = 0;
  virtual const set<string> &extensions() const = 0;

  // conbine IGeneratorMetas into one
  // should affect only at namespace_prefix and extensions
  // if the result is valid, otherwise
  // the group field should be cleared
  virtual IGeneratorMeta &operator+=(const IGeneratorMeta &that) = 0;
  virtual bool equals(const IGeneratorMeta &that) const = 0;
  virtual bool empty() const = 0;
  virtual bool contains(const IGeneratorMeta &that) const;
  explicit operator bool() const;

  virtual ~IGeneratorMeta() = default;
};

bool operator==(const IGeneratorMeta &lhs, const IGeneratorMeta &rhs);
bool operator!=(const IGeneratorMeta &lhs, const IGeneratorMeta &rhs);
#endif