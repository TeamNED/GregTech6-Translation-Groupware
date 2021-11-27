#ifndef NSGENERATORMETA_H
#define NSGENERATORMETA_H
#pragma once

#include <memory>

#include "IGeneratorMeta.hpp"

using std::shared_ptr;

class NSGeneratorMeta : public IGeneratorMeta {
private:
  string _namespace_prefix;
  shared_ptr<IGeneratorMeta> _parent;

public:
  NSGeneratorMeta() = default;
  NSGeneratorMeta(string namespace_prefix, shared_ptr<IGeneratorMeta> parent);
  NSGeneratorMeta(const NSGeneratorMeta &) = default;
  NSGeneratorMeta(NSGeneratorMeta &&) = default;
  NSGeneratorMeta &operator=(const NSGeneratorMeta &) = default;
  NSGeneratorMeta &operator=(NSGeneratorMeta &&) = default;
  ~NSGeneratorMeta() = default;

  virtual const string &group() const override;
  virtual string &namespace_prefix();
  virtual const string &namespace_prefix() const override;
  virtual bool cached() const override;
  virtual bool completed() const override;
  virtual const set<string> &extensions() const override;
  virtual shared_ptr<IGeneratorMeta> &parent();
  virtual const shared_ptr<IGeneratorMeta> &parent() const;

  virtual IGeneratorMeta &operator+=(const IGeneratorMeta &that) override;
  virtual bool equals(const IGeneratorMeta &that) const override;
  virtual bool empty() const override;
};
#endif